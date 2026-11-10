-- Roadmap SaaS S3: suscripciones, cobros con Wompi, cupones y recuperación de pagos fallidos.
--
-- Modelo de cobro: cada periodo se paga con el Web Checkout de Wompi (tarjeta, PSE, Nequi, Daviplata, Bancolombia),
-- sin guardar datos de pago. Tres días antes del vencimiento se crea el cobro de renovación y se avisa por correo;
-- si no se paga: avisos el día 1, 3 y 7 de mora y el día 14 el hogar pasa a Gratis (conserva sus datos).
-- El débito automático con tarjeta tokenizada queda para después (decisión en docs/ROADMAP-SAAS.md).
--
-- Quién escribe: el hogar crea su cobro (crear_cobro, admin); el pago lo confirma solo el webhook de Wompi
-- (registrar_pago_wompi, service_role); renovaciones y mora, el cron diario (procesar_vencimientos, service_role);
-- reembolsos y cupones, la consola. Montos en pesos enteros; a Wompi van en centavos (× 100).

create table public.suscripciones (
  household_id uuid primary key references public.households on delete cascade,
  plan         text not null references public.planes (codigo),
  periodo      text not null check (periodo in ('mensual', 'anual')),
  estado       text not null default 'activa' check (estado in ('activa', 'vencida', 'cancelada')),
  desde        date not null,
  vence        date not null,             -- pagado hasta esta fecha (ahí se cobra el siguiente periodo)
  monto_periodo bigint not null check (monto_periodo >= 0),  -- lo último que pagó por un periodo (para el MRR)
  cupon        text,
  cupon_periodos_restantes int,           -- cobros que aún llevan el descuento (null con cupón = para siempre)
  cancelar_al_vencer boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.suscripciones enable row level security;
create policy suscripciones_select on public.suscripciones for select to authenticated
  using (household_id in (select private.mis_hogares()));
revoke insert, update, delete, truncate on public.suscripciones from anon, authenticated;

create table public.cupones (
  codigo      text primary key check (codigo ~ '^[A-Z0-9_-]{3,30}$'),
  descripcion text not null default '',
  tipo        text not null check (tipo in ('porcentaje', 'meses_gratis')),
  valor       int not null check (valor > 0),       -- porcentaje (1–100) o meses gratis
  periodos    int check (periodos is null or periodos > 0), -- porcentaje: cuántos cobros (null = siempre)
  planes      text[] not null default '{familia}',
  periodo     text check (periodo in ('mensual', 'anual')), -- null = ambos
  usos_max    int check (usos_max is null or usos_max > 0),
  usos        int not null default 0,
  desde       timestamptz not null default now(),
  hasta       timestamptz,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (tipo <> 'porcentaje' or valor <= 100)
);
alter table public.cupones enable row level security;
revoke all on public.cupones from anon, authenticated;

create table public.cobros (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households on delete cascade,
  referencia      text not null unique,
  plan            text not null references public.planes (codigo),
  periodo         text not null check (periodo in ('mensual', 'anual')),
  motivo          text not null check (motivo in ('alta', 'renovacion')),
  precio          bigint not null check (precio >= 0),
  descuento       bigint not null default 0 check (descuento >= 0),
  monto           bigint not null check (monto >= 0),
  cupon           text,
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'fallido', 'anulado', 'reembolsado')),
  pasarela        text not null default 'wompi',
  transaccion_id  text,
  metodo          text,
  metodo_detalle  text,
  error           text,
  periodo_vence   date,                    -- renovación: el vencimiento que cubre (evita duplicarla)
  creado          timestamptz not null default now(),
  pagado_en       timestamptz,
  factura_estado  text not null default 'pendiente' check (factura_estado in ('pendiente', 'emitida', 'no_aplica')),
  factura_numero  text,
  factura_url     text,
  reembolso_motivo text,
  check (monto = precio - descuento)
);
create index cobros_hogar on public.cobros (household_id, creado desc);
create index cobros_estado on public.cobros (estado, creado desc);
create unique index cobros_renovacion_unica on public.cobros (household_id, periodo_vence)
  where motivo = 'renovacion' and estado in ('pendiente', 'pagado');
alter table public.cobros enable row level security;
-- El historial de pagos lo ve quien administra el hogar.
create policy cobros_select on public.cobros for select to authenticated
  using (exists (select 1 from public.members m where m.household_id = cobros.household_id
                  and m.user_id = (select auth.uid()) and m.rol = 'admin'));
revoke insert, update, delete, truncate on public.cobros from anon, authenticated;

create table public.cupones_usos (
  cupon        text not null references public.cupones (codigo) on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  cobro_id     uuid references public.cobros on delete set null,
  creado       timestamptz not null default now(),
  primary key (cupon, household_id)
);
alter table public.cupones_usos enable row level security;
revoke all on public.cupones_usos from anon, authenticated;

-- Cada evento de Wompi se procesa una sola vez (Wompi reintenta si no respondemos 200).
create table public.eventos_pasarela (
  id         text primary key,
  pasarela   text not null default 'wompi',
  referencia text,
  estado     text,
  payload    jsonb not null,
  resultado  text,
  recibido   timestamptz not null default now()
);
alter table public.eventos_pasarela enable row level security;
revoke all on public.eventos_pasarela from anon, authenticated;

-- ───────────────────────────── precio y cupones ─────────────────────────────

create function private.precio_plan(p_plan text, p_periodo text) returns bigint
language sql stable security definer set search_path = '' as $$
  select case p_periodo when 'anual' then precio_anual else precio_mensual end from public.planes where codigo = p_plan
$$;

-- Descuento de un cupón para un cobro. `primero`: el cobro de alta (los meses gratis solo aplican ahí).
create function private.descuento_cupon(c public.cupones, p_plan text, p_periodo text, precio bigint, primero boolean)
returns bigint
language sql stable security definer set search_path = '' as $$
  select least(precio, case c.tipo
    when 'porcentaje' then round(precio * c.valor / 100.0)::bigint
    when 'meses_gratis' then case when primero
      then (select round(p.precio_mensual * c.valor)::bigint from public.planes p where p.codigo = p_plan) else 0 end
  end)
$$;

-- Cupón válido para este hogar, plan y periodo, o excepción con el motivo.
create function private.validar_cupon(p_codigo text, p_hogar uuid, p_plan text, p_periodo text) returns public.cupones
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.cupones;
begin
  select * into c from public.cupones where codigo = upper(btrim(p_codigo));
  if c.codigo is null or not c.activo then
    raise exception 'El cupón % no existe o ya no está activo.', upper(btrim(p_codigo));
  end if;
  if c.desde > now() then
    raise exception 'El cupón % todavía no está disponible.', c.codigo;
  end if;
  if c.hasta is not null and c.hasta < now() then
    raise exception 'El cupón % ya venció.', c.codigo;
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    raise exception 'El cupón % ya se agotó.', c.codigo;
  end if;
  if not (p_plan = any (c.planes)) then
    raise exception 'El cupón % no aplica a este plan.', c.codigo;
  end if;
  if c.periodo is not null and c.periodo <> p_periodo then
    raise exception 'El cupón % solo aplica al pago %.', c.codigo, c.periodo;
  end if;
  if exists (select 1 from public.cupones_usos u where u.cupon = c.codigo and u.household_id = p_hogar) then
    raise exception 'Tu hogar ya usó el cupón %.', c.codigo;
  end if;
  return c;
end $$;

create function private.exigir_admin_hogar(p_hogar uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.tiene_rol(p_hogar, '{admin}') then
    raise exception 'Solo un administrador del hogar puede manejar el plan.';
  end if;
end $$;

-- Lo que pagaría el hogar (para mostrarlo antes de ir a Wompi).
create function public.cotizar_plan(p_hogar uuid, p_plan text, p_periodo text, p_cupon text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.cupones;
  precio bigint;
  descuento bigint := 0;
begin
  perform private.exigir_admin_hogar(p_hogar);
  if not exists (select 1 from public.planes where codigo = p_plan and publicado and para = 'hogar' and precio_mensual > 0) then
    raise exception 'Ese plan no está disponible.';
  end if;
  if p_periodo not in ('mensual', 'anual') then
    raise exception 'Elige pago mensual o anual.';
  end if;
  precio := private.precio_plan(p_plan, p_periodo);
  if nullif(btrim(coalesce(p_cupon, '')), '') is not null then
    c := private.validar_cupon(p_cupon, p_hogar, p_plan, p_periodo);
    descuento := private.descuento_cupon(c, p_plan, p_periodo, precio, true);
  end if;
  return jsonb_build_object('plan', p_plan, 'periodo', p_periodo, 'precio', precio, 'descuento', descuento,
                            'monto', precio - descuento, 'cupon', c.codigo, 'cupon_descripcion', c.descripcion);
end $$;

-- ───────────────────────────── aplicar un pago ─────────────────────────────

-- Marca el cobro como pagado y deja la suscripción al día. Si paga a tiempo (o en mora, antes de bajar a Gratis)
-- el periodo nuevo arranca donde terminó el anterior; si no, desde hoy.
create function private.aplicar_pago(p_cobro uuid, p_transaccion text, p_metodo text, p_detalle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.cobros;
  s public.suscripciones;
  hoy date := (now() at time zone 'America/Bogota')::date;
  base date;
  cup public.cupones;
  restantes int;
begin
  select * into c from public.cobros where id = p_cobro for update;
  if c.estado = 'pagado' then
    return;
  end if;
  update public.cobros
     set estado = 'pagado', pagado_en = now(), transaccion_id = coalesce(p_transaccion, transaccion_id),
         metodo = coalesce(p_metodo, metodo), metodo_detalle = coalesce(p_detalle, metodo_detalle), error = null,
         factura_estado = case when monto = 0 then 'no_aplica' else factura_estado end
   where id = p_cobro;

  select * into s from public.suscripciones where household_id = c.household_id for update;
  base := case when s.household_id is not null and s.estado in ('activa', 'vencida') and s.plan = c.plan
                    and s.periodo = c.periodo and s.vence >= hoy - 14
               then greatest(s.vence, hoy - 14) else hoy end;

  -- Cupón: en el alta se registra su uso y se fija cuántos cobros más llevan descuento; cada renovación con
  -- descuento descuenta uno (null = para siempre; los meses gratis solo aplican al alta).
  if c.motivo = 'alta' then
    if c.cupon is not null then
      select * into cup from public.cupones where codigo = c.cupon;
      insert into public.cupones_usos (cupon, household_id, cobro_id) values (c.cupon, c.household_id, c.id)
        on conflict do nothing;
      if found then
        update public.cupones set usos = usos + 1 where codigo = c.cupon;
      end if;
      restantes := case when cup.tipo = 'porcentaje' then case when cup.periodos is null then null else cup.periodos - 1 end
                        else 0 end;
    end if;
  else
    restantes := case when c.descuento > 0 and s.cupon_periodos_restantes is not null
                      then greatest(s.cupon_periodos_restantes - 1, 0) else s.cupon_periodos_restantes end;
  end if;

  insert into public.suscripciones as x (household_id, plan, periodo, estado, desde, vence, monto_periodo, cupon,
                                         cupon_periodos_restantes, cancelar_al_vencer)
  values (c.household_id, c.plan, c.periodo, 'activa', base,
          (base + case c.periodo when 'anual' then interval '1 year' else interval '1 month' end)::date,
          c.monto, c.cupon, restantes, false)
  on conflict (household_id) do update
     set plan = excluded.plan, periodo = excluded.periodo, estado = 'activa',
         desde = case when x.plan = excluded.plan and x.periodo = excluded.periodo and x.estado <> 'cancelada' then x.desde else excluded.desde end,
         vence = excluded.vence, monto_periodo = excluded.monto_periodo,
         cupon = case when c.motivo = 'alta' then excluded.cupon else x.cupon end,
         cupon_periodos_restantes = restantes,
         cancelar_al_vencer = false, updated_at = now();

  update public.households set plan = c.plan, prueba_hasta = null where id = c.household_id;
end $$;

-- ───────────────────────────── lado del hogar ─────────────────────────────

-- Crea el cobro de alta (o cambio de plan/periodo) y devuelve la referencia para Wompi. Anula los pendientes de
-- alta anteriores. Si el monto es 0 (cupón), se activa de una vez.
create function public.crear_cobro(p_hogar uuid, p_plan text, p_periodo text, p_cupon text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  q jsonb := public.cotizar_plan(p_hogar, p_plan, p_periodo, p_cupon);
  ref text := 'MH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  nuevo uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('cobro:' || p_hogar::text, 0));
  update public.cobros set estado = 'anulado' where household_id = p_hogar and estado = 'pendiente' and motivo = 'alta';
  insert into public.cobros (household_id, referencia, plan, periodo, motivo, precio, descuento, monto, cupon)
  values (p_hogar, ref, p_plan, p_periodo, 'alta', (q ->> 'precio')::bigint, (q ->> 'descuento')::bigint,
          (q ->> 'monto')::bigint, q ->> 'cupon')
  returning cobros.id into nuevo;
  if (q ->> 'monto')::bigint = 0 then
    perform private.aplicar_pago(nuevo, null, 'cupon', q ->> 'cupon');
  end if;
  return q || jsonb_build_object('id', nuevo, 'referencia', ref, 'activado', (q ->> 'monto')::bigint = 0);
end $$;

-- Datos de un cobro pendiente del hogar para volver a ir a pagar (renovación o alta sin terminar).
create function public.cobro_pendiente(p_hogar uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_admin_hogar(p_hogar);
  return (select to_jsonb(c) from public.cobros c where c.household_id = p_hogar and c.estado = 'pendiente'
           order by (c.motivo = 'renovacion') desc, c.creado desc limit 1);
end $$;

create function public.cancelar_al_vencer(p_hogar uuid, p_cancelar boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.exigir_admin_hogar(p_hogar);
  update public.suscripciones set cancelar_al_vencer = p_cancelar, updated_at = now()
   where household_id = p_hogar and estado = 'activa';
  if not found then
    raise exception 'Tu hogar no tiene una suscripción activa.';
  end if;
end $$;

-- ───────────────────────────── webhook de Wompi ─────────────────────────────

-- Lo llama /api/pagos/wompi (service_role) con un evento ya verificado (firma). Idempotente por evento.
create function public.registrar_pago_wompi(p_evento text, p_referencia text, p_transaccion text, p_estado text,
                                            p_monto_centavos bigint, p_metodo text, p_detalle text, p_payload jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.cobros;
  v_resultado text;
begin
  insert into public.eventos_pasarela (id, referencia, estado, payload) values (p_evento, p_referencia, p_estado, p_payload)
    on conflict do nothing;
  if not found then
    return jsonb_build_object('resultado', 'duplicado');
  end if;

  select * into c from public.cobros where referencia = p_referencia for update;
  if c.id is null then
    v_resultado := 'desconocido';
  elsif c.estado = 'pagado' then
    v_resultado := 'ya_pagado';
  elsif p_estado = 'APPROVED' then
    if p_monto_centavos <> c.monto * 100 then
      update public.cobros set estado = 'fallido', transaccion_id = p_transaccion, error = 'El monto pagado no coincide.' where id = c.id;
      v_resultado := 'monto_distinto';
    else
      perform private.aplicar_pago(c.id, p_transaccion, p_metodo, p_detalle);
      v_resultado := 'aplicado';
    end if;
  elsif p_estado in ('DECLINED', 'ERROR') then
    update public.cobros set estado = case when estado = 'pendiente' then 'fallido' else estado end,
           transaccion_id = p_transaccion, metodo = p_metodo, metodo_detalle = p_detalle,
           error = case p_estado when 'DECLINED' then 'Pago rechazado' else 'Error en el pago' end
     where id = c.id;
    v_resultado := 'fallido';
  elsif p_estado = 'VOIDED' then
    update public.cobros set estado = 'anulado', transaccion_id = p_transaccion where id = c.id and estado = 'pendiente';
    v_resultado := 'anulado';
  else
    update public.cobros set transaccion_id = p_transaccion, metodo = p_metodo, metodo_detalle = p_detalle where id = c.id;
    v_resultado := 'pendiente';
  end if;

  update public.eventos_pasarela set resultado = v_resultado where id = p_evento;
  return jsonb_build_object('resultado', v_resultado, 'hogar', c.household_id, 'cobro', c.id, 'plan', c.plan,
                            'periodo', c.periodo, 'monto', c.monto, 'referencia', c.referencia);
end $$;

-- ───────────────────────────── vencimientos (cron diario) ─────────────────────────────

-- Renueva, marca la mora, baja a Gratis y avisa de pruebas por terminar. Devuelve los avisos que el cron debe enviar
-- por correo (el cron evita repetirlos con avisos_enviados). Idempotente: correrlo dos veces el mismo día no cambia nada.
create function public.procesar_vencimientos(p_hoy date) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.suscripciones;
  avisos jsonb := '[]'::jsonb;
  precio bigint;
  descuento bigint;
  cup public.cupones;
  ref text;
  cid uuid;
  mora int;
  h record;
begin
  for s in select * from public.suscripciones where estado in ('activa', 'vencida') for update loop
    mora := p_hoy - s.vence;

    -- Pidió cancelar: al vencer pasa a Gratis sin mora.
    if s.cancelar_al_vencer and mora >= 0 then
      update public.suscripciones set estado = 'cancelada', updated_at = now() where household_id = s.household_id;
      update public.households set plan = 'gratis' where id = s.household_id;
      update public.cobros set estado = 'anulado' where household_id = s.household_id and estado = 'pendiente';
      avisos := avisos || jsonb_build_object('tipo', 'cancelada', 'hogar', s.household_id, 'plan', s.plan, 'vence', s.vence);
      continue;
    end if;

    -- 3 días antes: cobro de renovación (una vez por vencimiento).
    if mora >= -3 and not s.cancelar_al_vencer
       and not exists (select 1 from public.cobros c where c.household_id = s.household_id and c.motivo = 'renovacion'
                        and c.periodo_vence = s.vence and c.estado in ('pendiente', 'pagado')) then
      precio := private.precio_plan(s.plan, s.periodo);
      descuento := 0;
      if s.cupon is not null and (s.cupon_periodos_restantes is null or s.cupon_periodos_restantes > 0) then
        select * into cup from public.cupones where codigo = s.cupon;
        if cup.codigo is not null then
          descuento := private.descuento_cupon(cup, s.plan, s.periodo, precio, false);
        end if;
      end if;
      ref := 'MH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      insert into public.cobros (household_id, referencia, plan, periodo, motivo, precio, descuento, monto, cupon, periodo_vence)
      values (s.household_id, ref, s.plan, s.periodo, 'renovacion', precio, descuento, precio - descuento,
              case when descuento > 0 then s.cupon end, s.vence)
      returning id into cid;
      if precio - descuento = 0 then
        perform private.aplicar_pago(cid, null, 'cupon', s.cupon);
        continue;
      end if;
      avisos := avisos || jsonb_build_object('tipo', 'renovacion', 'hogar', s.household_id, 'plan', s.plan,
                                             'periodo', s.periodo, 'vence', s.vence, 'monto', precio - descuento);
    end if;

    if mora >= 1 and s.estado = 'activa' then
      update public.suscripciones set estado = 'vencida', updated_at = now() where household_id = s.household_id;
    end if;
    if mora in (1, 3, 7) then
      avisos := avisos || jsonb_build_object('tipo', 'mora', 'dia', mora, 'hogar', s.household_id, 'plan', s.plan,
                                             'vence', s.vence, 'baja', s.vence + 14,
                                             'monto', (select c.monto from public.cobros c where c.household_id = s.household_id
                                                        and c.motivo = 'renovacion' and c.periodo_vence = s.vence
                                                        and c.estado = 'pendiente' limit 1));
    end if;
    if mora >= 14 then
      update public.suscripciones set estado = 'cancelada', updated_at = now() where household_id = s.household_id;
      update public.households set plan = 'gratis' where id = s.household_id;
      update public.cobros set estado = 'anulado' where household_id = s.household_id and estado = 'pendiente';
      avisos := avisos || jsonb_build_object('tipo', 'gratis', 'hogar', s.household_id, 'plan', s.plan, 'vence', s.vence);
    end if;
  end loop;

  -- Pruebas que terminan en 2 días.
  for h in select id, prueba_hasta from public.households
            where plan = 'gratis' and (prueba_hasta at time zone 'America/Bogota')::date = p_hoy + 2 loop
    avisos := avisos || jsonb_build_object('tipo', 'prueba', 'hogar', h.id, 'hasta', h.prueba_hasta);
  end loop;

  return avisos;
end $$;

revoke execute on function public.registrar_pago_wompi(text, text, text, text, bigint, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.procesar_vencimientos(date) from public, anon, authenticated;
grant execute on function public.registrar_pago_wompi(text, text, text, text, bigint, text, text, jsonb) to service_role;
grant execute on function public.procesar_vencimientos(date) to service_role;
do $$
declare
  f text;
begin
  foreach f in array array['cotizar_plan(uuid, text, text, text)', 'crear_cobro(uuid, text, text, text)',
                           'cobro_pendiente(uuid)', 'cancelar_al_vencer(uuid, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ───────────────────────────── consola ─────────────────────────────

-- MRR del hogar: lo que paga por periodo, mensualizado (anual / 12). Activa o en mora cuenta; cancelada no.
create or replace function private.mrr_hogar(h uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce((select case s.periodo when 'anual' then round(s.monto_periodo / 12.0)::bigint else s.monto_periodo end
                     from public.suscripciones s where s.household_id = h and s.estado in ('activa', 'vencida')), 0)
$$;

create or replace function private.hogar_cumple_filtro(hh public.households, filtro text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case coalesce(filtro, 'todos')
    when 'todos' then true
    when 'gratis' then hh.plan = 'gratis' and not coalesce(hh.prueba_hasta > now(), false)
    when 'prueba' then hh.plan = 'gratis' and coalesce(hh.prueba_hasta > now(), false)
    when 'suspendidos' then hh.estado = 'suspendido'
    when 'pago_fallido' then exists (select 1 from public.suscripciones s where s.household_id = hh.id and s.estado = 'vencida')
    else hh.plan = filtro
  end
$$;

create or replace function public.consola_hogares_conteos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return (
    select jsonb_build_object(
      'todos', count(*),
      'familia', count(*) filter (where plan = 'familia'),
      'contador', count(*) filter (where plan = 'contador'),
      'gratis', count(*) filter (where plan = 'gratis' and not coalesce(prueba_hasta > now(), false)),
      'prueba', count(*) filter (where plan = 'gratis' and coalesce(prueba_hasta > now(), false)),
      'pago_fallido', (select count(*) from public.suscripciones where estado = 'vencida'),
      'suspendidos', count(*) filter (where estado = 'suspendido'))
    from public.households);
end $$;

-- Suscripción y cobros de un hogar (Detalle de hogar).
create function public.consola_hogar_cobros(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'suscripcion', (select to_jsonb(s) from public.suscripciones s where s.household_id = p_id),
    'mrr', private.mrr_hogar(p_id),
    'total', (select coalesce(sum(monto), 0) from public.cobros where household_id = p_id and estado = 'pagado'),
    'cobros', coalesce((select jsonb_agg(to_jsonb(c) order by c.creado desc)
                          from (select * from public.cobros where household_id = p_id order by creado desc limit 24) c), '[]'::jsonb));
end $$;

create function public.consola_cobros(p_estado text default null, p_antes timestamptz default null, p_limite int default 30)
returns table (id uuid, creado timestamptz, household_id uuid, hogar text, plan text, periodo text, motivo text, monto bigint,
               descuento bigint, cupon text, estado text, pasarela text, metodo text, metodo_detalle text, error text,
               factura_estado text, pagado_en timestamptz, referencia text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return query
    select c.id, c.creado, c.household_id, hh.nombre, c.plan, c.periodo, c.motivo, c.monto, c.descuento, c.cupon, c.estado,
           c.pasarela, c.metodo, c.metodo_detalle, c.error, c.factura_estado, c.pagado_en, c.referencia
      from public.cobros c join public.households hh on hh.id = c.household_id
     where (p_estado is null or c.estado = p_estado) and (p_antes is null or c.creado < p_antes)
     order by c.creado desc
     limit least(greatest(coalesce(p_limite, 30), 1), 100);
end $$;

create function public.consola_cobros_resumen() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  mes timestamptz := private.inicio_mes_bogota();
  hoy date := (now() at time zone 'America/Bogota')::date;
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'cobrado_mes', (select coalesce(sum(monto), 0) from public.cobros where estado = 'pagado' and pagado_en >= mes),
    'cobros_mes', (select count(*) from public.cobros where estado = 'pagado' and pagado_en >= mes and monto > 0),
    'fallidos_30d', (select count(*) from public.cobros where estado = 'fallido' and creado > now() - interval '30 days'),
    'mora_monto', (select coalesce(sum(c.monto), 0) from public.suscripciones s join public.cobros c
                    on c.household_id = s.household_id and c.motivo = 'renovacion' and c.periodo_vence = s.vence and c.estado = 'pendiente'
                    where s.estado = 'vencida'),
    'en_mora', (select count(*) from public.suscripciones where estado = 'vencida'),
    'recuperados_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where pagado) / count(*)) end
                          from (select exists (select 1 from public.cobros p where p.household_id = f.household_id and p.estado = 'pagado'
                                                 and p.pagado_en > f.creado) pagado
                                  from public.cobros f where f.estado = 'fallido' and f.creado > now() - interval '90 days') x),
    'proximos_7d', (select coalesce(sum(case when s.cupon is null then private.precio_plan(s.plan, s.periodo) else s.monto_periodo end), 0)
                      from public.suscripciones s where s.estado = 'activa' and not s.cancelar_al_vencer and s.vence between hoy and hoy + 7),
    'proximos_7d_n', (select count(*) from public.suscripciones s where s.estado = 'activa' and not s.cancelar_al_vencer and s.vence between hoy and hoy + 7),
    'mrr', (select coalesce(sum(private.mrr_hogar(household_id)), 0) from public.suscripciones),
    'activas', (select count(*) from public.suscripciones where estado in ('activa', 'vencida')),
    'metodos', coalesce((select jsonb_object_agg(m, n) from (select coalesce(metodo, 'otro') m, count(*) n from public.cobros
                           where estado = 'pagado' and monto > 0 and pagado_en > now() - interval '30 days' group by 1) x), '{}'::jsonb));
end $$;

-- El dinero se devuelve en el panel de Wompi; aquí queda registrado (y, si se pide, el hogar vuelve a Gratis).
create function public.consola_marcar_reembolso(p_cobro uuid, p_motivo text, p_bajar_plan boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  c public.cobros;
  nombre text;
begin
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escribe el motivo del reembolso.';
  end if;
  select * into c from public.cobros where id = p_cobro for update;
  if c.id is null or c.estado <> 'pagado' then
    raise exception 'Solo se reembolsa un cobro pagado.';
  end if;
  update public.cobros set estado = 'reembolsado', reembolso_motivo = btrim(p_motivo) where id = p_cobro;
  if p_bajar_plan then
    update public.suscripciones set estado = 'cancelada', updated_at = now() where household_id = c.household_id;
    update public.households set plan = 'gratis' where id = c.household_id;
  end if;
  select hh.nombre into nombre from public.households hh where hh.id = c.household_id;
  perform private.auditar(s.user_id, s.nombre, 'reembolso', 'hogar', c.household_id::text, nombre,
                          jsonb_build_object('monto', c.monto, 'referencia', c.referencia, 'motivo', btrim(p_motivo), 'bajo_a_gratis', p_bajar_plan));
end $$;

create function public.consola_cupones() returns setof public.cupones
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return query select * from public.cupones order by activo desc, created_at desc;
end $$;

create function public.consola_guardar_cupon(p_codigo text, p_descripcion text, p_tipo text, p_valor int, p_periodos int,
                                             p_planes text[], p_periodo text, p_usos_max int, p_desde timestamptz,
                                             p_hasta timestamptz, p_activo boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('planes');
  v_codigo text := upper(btrim(p_codigo));
  existia boolean;
begin
  if v_codigo !~ '^[A-Z0-9_-]{3,30}$' then
    raise exception 'El código lleva de 3 a 30 letras, números, guion o guion bajo.';
  end if;
  if p_hasta is not null and p_hasta <= coalesce(p_desde, now()) then
    raise exception 'La fecha de vencimiento debe ser posterior al inicio.';
  end if;
  if exists (select 1 from unnest(p_planes) x where x not in (select planes.codigo from public.planes)) or cardinality(p_planes) = 0 then
    raise exception 'Elige al menos un plan válido.';
  end if;
  existia := exists (select 1 from public.cupones where cupones.codigo = v_codigo);
  insert into public.cupones (codigo, descripcion, tipo, valor, periodos, planes, periodo, usos_max, desde, hasta, activo)
  values (v_codigo, btrim(coalesce(p_descripcion, '')), p_tipo, p_valor, p_periodos, p_planes, p_periodo, p_usos_max,
          coalesce(p_desde, now()), p_hasta, p_activo)
  on conflict (codigo) do update
     set descripcion = excluded.descripcion, tipo = excluded.tipo, valor = excluded.valor, periodos = excluded.periodos,
         planes = excluded.planes, periodo = excluded.periodo, usos_max = excluded.usos_max, desde = excluded.desde,
         hasta = excluded.hasta, activo = excluded.activo;
  perform private.auditar(s.user_id, s.nombre, case when existia then 'edito_cupon' else 'creo_cupon' end, 'cupon', v_codigo, v_codigo,
                          jsonb_build_object('tipo', p_tipo, 'valor', p_valor, 'activo', p_activo));
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['consola_hogar_cobros(uuid)', 'consola_cobros(text, timestamptz, int)', 'consola_cobros_resumen()',
                           'consola_marcar_reembolso(uuid, text, boolean)', 'consola_cupones()',
                           'consola_guardar_cupon(text, text, text, int, int, text[], text, int, timestamptz, timestamptz, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
