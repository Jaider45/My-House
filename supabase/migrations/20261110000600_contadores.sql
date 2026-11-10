-- Roadmap SaaS S5: varios hogares por usuario (selector), plan Contador con panel de clientes, enlace de
-- referidos y comisiones.
--
-- * `hogar_activo`: qué hogar está operando cada usuario. El hook del JWT lo respeta; cambiarlo refresca la sesión.
--   Reemplaza la decisión 14 (antes: siempre el primer hogar).
-- * Referidos: una firma con plan Contador tiene un código (`households.ref_codigo`); quien se registra con su
--   enlace queda con `referido_por` y canal «contador». La comisión es el % del plan sobre lo que pagan sus
--   referidos, liquidada por mes desde la consola.
-- * Límite de clientes: al aceptar una invitación de contador, si la persona tiene una firma con plan Contador,
--   la base exige el tope `hogares` de su plan.

create table public.hogar_activo (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  updated_at   timestamptz not null default now()
);
alter table public.hogar_activo enable row level security;
revoke all on public.hogar_activo from anon, authenticated;

alter table public.households
  add column ref_codigo text unique check (ref_codigo is null or ref_codigo ~ '^[A-Z0-9]{6,12}$'),
  add column contador_verificado boolean not null default false;

create table public.comisiones (
  id         uuid primary key default gen_random_uuid(),
  firma      uuid not null references public.households (id) on delete cascade,
  mes        date not null,
  pct        int not null,
  hogares    int not null default 0,
  base       bigint not null default 0,   -- lo que pagaron sus referidos ese mes
  monto      bigint not null default 0,
  estado     text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  pagada_en  timestamptz,
  created_at timestamptz not null default now(),
  unique (firma, mes)
);
alter table public.comisiones enable row level security;
-- La firma ve sus propias comisiones; solo la consola las escribe.
create policy comisiones_firma on public.comisiones for select to authenticated
  using (private.tiene_rol(firma, '{admin}'));
revoke insert, update, delete, truncate on public.comisiones from anon, authenticated;

-- ───────────────────────────── hogar activo ─────────────────────────────

-- Hogar que la persona está operando: el elegido si sigue siendo miembro; si no, el primero al que entró.
create function private.hogar_activo_de(p_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select ha.household_id from public.hogar_activo ha
      where ha.user_id = p_user
        and exists (select 1 from public.members m where m.household_id = ha.household_id and m.user_id = p_user)),
    (select m.household_id from public.members m where m.user_id = p_user order by m.created_at limit 1))
$$;

create function public.elegir_hogar(p_hogar uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.members m where m.household_id = p_hogar and m.user_id = (select auth.uid())) then
    raise exception 'No perteneces a ese hogar.';
  end if;
  insert into public.hogar_activo (user_id, household_id) values ((select auth.uid()), p_hogar)
  on conflict (user_id) do update set household_id = excluded.household_id, updated_at = now();
end $$;

-- Hogares de la persona para el selector (y para saber si es contadora de alguno).
create function public.mis_hogares_lista()
returns table (id uuid, nombre text, rol public.rol_miembro, plan text, activo boolean)
language sql stable security definer set search_path = '' as $$
  select h.id, h.nombre, m.rol, h.plan, h.id = private.hogar_activo_de((select auth.uid()))
    from public.members m join public.households h on h.id = m.household_id
   where m.user_id = (select auth.uid())
   order by m.created_at
$$;

-- El JWT trae el hogar activo (antes: siempre el primero).
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ctx jsonb;
  staff jsonb;
  uid uuid := (event ->> 'user_id')::uuid;
  claims jsonb := event -> 'claims';
begin
  claims := jsonb_set(claims, '{mfa_activa}', to_jsonb(exists (
    select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified')));

  select jsonb_build_object(
           'miembro_id', m.id, 'miembro_nombre', m.nombre, 'rol', m.rol,
           'hogar_id', h.id, 'hogar_nombre', h.nombre, 'pais', h.pais, 'moneda', h.moneda,
           'cuota_imprevistos_pct', coalesce((h.config ->> 'cuota_imprevistos_pct')::int, 10),
           'suspendido', h.estado = 'suspendido')
    into ctx
    from public.members m
    join public.households h on h.id = m.household_id
   where m.user_id = uid and m.household_id = private.hogar_activo_de(uid);
  claims := case when ctx is null then claims - 'hogar' else jsonb_set(claims, '{hogar}', ctx) end;

  select jsonb_build_object('rol', p.rol, 'nombre', p.nombre) into staff
    from public.platform_staff p where p.user_id = uid and p.activo;
  claims := case when staff is null then claims - 'staff' else jsonb_set(claims, '{staff}', staff) end;

  return jsonb_set(event, '{claims}', claims);
end $$;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Crear un hogar lo vuelve el activo, y el enlace de referido ya se resuelve (ref_codigo existe desde esta migración).
create or replace function public.crear_hogar(p_nombre text, p_nombre_miembro text, p_canal text default null, p_ref text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  h uuid;
  canal text := lower(btrim(coalesce(p_canal, '')));
  firma uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'no autenticado';
  end if;
  if canal !~ '^[\w-]{1,40}$' then
    canal := null;
  end if;
  if nullif(btrim(coalesce(p_ref, '')), '') is not null then
    select hh.id into firma from public.households hh where hh.ref_codigo = upper(btrim(p_ref));
    if firma is not null then
      canal := 'contador';
    end if;
  end if;
  insert into public.households (nombre, canal, referido_por) values (btrim(p_nombre), canal, firma) returning id into h;
  insert into public.members (household_id, user_id, nombre, rol)
    values (h, (select auth.uid()), btrim(p_nombre_miembro), 'admin');
  insert into public.hogar_activo (user_id, household_id) values ((select auth.uid()), h)
  on conflict (user_id) do update set household_id = excluded.household_id, updated_at = now();
  perform private.sembrar_categorias(h);
  perform private.registrar_evento(h, 'registro');
  return h;
end $$;

-- ───────────────────────────── panel del contador ─────────────────────────────

-- Hogares donde la persona es contadora (su cartera de clientes).
create function public.mis_clientes()
returns table (id uuid, nombre text, pais char(2), admin_nombre text, miembros int, movimientos_30d int,
               ultimo_movimiento date, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select h.id, h.nombre, h.pais,
         (select m2.nombre from public.members m2 where m2.household_id = h.id and m2.rol = 'admin' order by m2.created_at limit 1),
         (select count(*)::int from public.members m2 where m2.household_id = h.id and m2.user_id is not null),
         (select count(*)::int from public.transactions t where t.household_id = h.id and t.created_at > now() - interval '30 days'),
         (select max(t.fecha) from public.transactions t where t.household_id = h.id),
         h.created_at
    from public.members m join public.households h on h.id = m.household_id
   where m.user_id = (select auth.uid()) and m.rol = 'contador'
   order by h.nombre
$$;

-- La firma de la persona: su hogar con plan Contador donde es admin (o null).
create function private.firma_de(p_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.household_id
    from public.members m join public.households h on h.id = m.household_id
   where m.user_id = p_user and m.rol = 'admin' and private.plan_efectivo(h.id) = 'contador'
   order by m.created_at limit 1
$$;

-- Datos de la firma para el panel: código de referido, referidos y comisiones. null si no tiene plan Contador.
create function public.mi_firma() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  f uuid := private.firma_de((select auth.uid()));
begin
  if f is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', f,
    'nombre', (select nombre from public.households where id = f),
    'ref_codigo', (select ref_codigo from public.households where id = f),
    'verificada', (select contador_verificado from public.households where id = f),
    'limites', (select p.limites from public.planes p where p.codigo = 'contador'),
    'clientes', (select count(*) from public.members m where m.user_id = (select auth.uid()) and m.rol = 'contador'),
    'referidos', (select count(*) from public.households h where h.referido_por = f),
    'referidos_pagando', (select count(*) from public.households h join public.suscripciones s on s.household_id = h.id
                           where h.referido_por = f and s.estado in ('activa', 'vencida')),
    'comisiones', coalesce((select jsonb_agg(jsonb_build_object('mes', to_char(c.mes, 'YYYY-MM'), 'monto', c.monto,
                                                                'hogares', c.hogares, 'estado', c.estado) order by c.mes desc)
                              from (select * from public.comisiones where firma = f order by mes desc limit 6) c), '[]'::jsonb));
end $$;

-- Crea (una vez) y devuelve el código de referido de la firma.
create function public.obtener_ref(p_hogar uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  codigo text;
  intento int := 0;
begin
  if not private.tiene_rol(p_hogar, '{admin}') then
    raise exception 'Solo un administrador de la firma puede crear el enlace.';
  end if;
  if private.plan_efectivo(p_hogar) <> 'contador' then
    raise exception 'El enlace de referidos es del plan Contador.';
  end if;
  select ref_codigo into codigo from public.households where id = p_hogar for update;
  if codigo is not null then
    return codigo;
  end if;
  loop
    intento := intento + 1;
    codigo := upper(substr(replace(encode(extensions.gen_random_bytes(8), 'hex'), '0', 'A'), 1, 8));
    begin
      update public.households set ref_codigo = codigo where id = p_hogar;
      return codigo;
    exception when unique_violation then
      if intento > 5 then raise; end if;
    end;
  end loop;
end $$;

-- Límite de clientes del plan Contador al aceptar una invitación de contador. Una persona sin firma no tiene tope
-- (puede mirar hogares sueltos); el tope es del plan, que es el que da el panel.
create or replace function public.aceptar_invitacion(p_token text, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  firma uuid;
  tope int;
  clientes int;
begin
  if (select auth.uid()) is null then
    raise exception 'no autenticado';
  end if;
  select * into inv from public.invitations
    where token = p_token and aceptada_en is null and expira_en > now()
    for update;
  if not found then
    raise exception 'la invitación no existe o ya venció';
  end if;
  if lower(inv.email) <> lower(coalesce((select auth.jwt()) ->> 'email', '')) then
    raise exception 'la invitación es para otro correo';
  end if;
  if inv.rol = 'contador' then
    firma := private.firma_de((select auth.uid()));
    if firma is not null then
      tope := private.limite_num(firma, 'hogares')::int;
      select count(*) into clientes from public.members m where m.user_id = (select auth.uid()) and m.rol = 'contador';
      if tope is not null and clientes >= tope then
        raise exception 'Tu plan Contador permite % hogares clientes. Escríbenos para ampliarlo.', tope;
      end if;
    end if;
  end if;
  insert into public.members (household_id, user_id, nombre, rol)
    values (inv.household_id, (select auth.uid()), btrim(p_nombre), inv.rol)
    on conflict (household_id, user_id) do nothing;
  update public.invitations set aceptada_en = now() where id = inv.id;
  return inv.household_id;
end $$;

-- El plan Contador también se compra desde Configuración → Plan (antes solo planes de hogar).
create or replace function public.cotizar_plan(p_hogar uuid, p_plan text, p_periodo text, p_cupon text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.cupones;
  precio bigint;
  descuento bigint := 0;
begin
  perform private.exigir_admin_hogar(p_hogar);
  if not exists (select 1 from public.planes where codigo = p_plan and publicado and precio_mensual > 0) then
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

-- ───────────────────────────── consola: contadores ─────────────────────────────

create function public.consola_contadores() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  mes date := (date_trunc('month', now() at time zone 'America/Bogota'))::date;
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'firmas', coalesce((select jsonb_agg(fila order by fila ->> 'created_at') from (
      select jsonb_build_object(
        'id', h.id, 'nombre', h.nombre, 'verificada', h.contador_verificado, 'ref_codigo', h.ref_codigo,
        'admin', (select m.nombre from public.members m where m.household_id = h.id and m.rol = 'admin' order by m.created_at limit 1),
        'clientes', (select count(*) from public.members m2
                      where m2.rol = 'contador' and m2.user_id in
                            (select m3.user_id from public.members m3 where m3.household_id = h.id and m3.rol = 'admin' and m3.user_id is not null)),
        'referidos', (select count(*) from public.households r where r.referido_por = h.id),
        'referidos_pagando', (select count(*) from public.households r join public.suscripciones s on s.household_id = r.id
                               where r.referido_por = h.id and s.estado in ('activa', 'vencida')),
        'comision_mes', (select coalesce(round(coalesce(private.limite_num(h.id, 'comision_pct'), 0) / 100.0
                                 * sum(c.monto))::bigint, 0)
                           from public.cobros c join public.households r on r.id = c.household_id
                          where r.referido_por = h.id and c.pagado_en is not null
                            and date_trunc('month', c.pagado_en at time zone 'America/Bogota') = mes),
        'created_at', h.created_at) as fila
        from public.households h where h.plan = 'contador') x), '[]'::jsonb),
    'comisiones', coalesce((select jsonb_agg(jsonb_build_object(
          'id', c.id, 'firma', c.firma, 'firma_nombre', hh.nombre, 'mes', to_char(c.mes, 'YYYY-MM'), 'pct', c.pct,
          'hogares', c.hogares, 'base', c.base, 'monto', c.monto, 'estado', c.estado, 'pagada_en', c.pagada_en)
          order by c.mes desc, hh.nombre)
        from public.comisiones c join public.households hh on hh.id = c.firma), '[]'::jsonb));
end $$;

create function public.consola_verificar_contador(p_id uuid, p_verificada boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  h public.households;
begin
  select * into h from public.households where id = p_id and plan = 'contador' for update;
  if h.id is null then
    raise exception 'Esa firma no existe o no tiene el plan Contador.';
  end if;
  if h.contador_verificado = p_verificada then
    return;
  end if;
  update public.households set contador_verificado = p_verificada where id = p_id;
  perform private.auditar(s.user_id, s.nombre, case when p_verificada then 'verifico_contador' else 'retiro_verificacion_contador' end,
                          'hogar', p_id::text, h.nombre);
end $$;

-- Liquida las comisiones de un mes ya terminado: % del plan sobre los cobros pagados de los referidos de cada firma.
create function public.consola_liquidar_comisiones(p_mes date) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  v_mes date := date_trunc('month', p_mes)::date;
  f record;
  firmas int := 0;
  total bigint := 0;
begin
  if v_mes >= (date_trunc('month', now() at time zone 'America/Bogota'))::date then
    raise exception 'Liquida un mes ya terminado.';
  end if;
  for f in
    select h.id, coalesce(private.limite_num(h.id, 'comision_pct'), 0)::int as pct,
           count(distinct c.household_id)::int as hogares, coalesce(sum(c.monto), 0)::bigint as base
      from public.households h
      join public.households r on r.referido_por = h.id
      join public.cobros c on c.household_id = r.id and c.pagado_en is not null
       and date_trunc('month', c.pagado_en at time zone 'America/Bogota') = v_mes and c.estado = 'pagado'
     where h.plan = 'contador'
     group by h.id
  loop
    continue when f.pct = 0 or f.base = 0;
    insert into public.comisiones as x (firma, mes, pct, hogares, base, monto)
    values (f.id, v_mes, f.pct, f.hogares, f.base, round(f.base * f.pct / 100.0)::bigint)
    on conflict (firma, mes) do update
       set pct = excluded.pct, hogares = excluded.hogares, base = excluded.base, monto = excluded.monto
     where x.estado = 'pendiente';
    firmas := firmas + 1;
    total := total + round(f.base * f.pct / 100.0)::bigint;
  end loop;
  perform private.auditar(s.user_id, s.nombre, 'liquido_comisiones', 'comisiones', to_char(v_mes, 'YYYY-MM'), to_char(v_mes, 'YYYY-MM'),
                          jsonb_build_object('firmas', firmas, 'total', total));
  return jsonb_build_object('mes', to_char(v_mes, 'YYYY-MM'), 'firmas', firmas, 'total', total);
end $$;

create function public.consola_marcar_comision(p_id uuid, p_pagada boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  c public.comisiones;
  nombre text;
begin
  update public.comisiones
     set estado = case when p_pagada then 'pagada' else 'pendiente' end,
         pagada_en = case when p_pagada then now() end
   where id = p_id returning * into c;
  if c.id is null then
    raise exception 'No encontramos esa comisión.';
  end if;
  select hh.nombre into nombre from public.households hh where hh.id = c.firma;
  perform private.auditar(s.user_id, s.nombre, case when p_pagada then 'pago_comision' else 'reabrio_comision' end,
                          'comision', c.id::text, nombre, jsonb_build_object('mes', to_char(c.mes, 'YYYY-MM'), 'monto', c.monto));
end $$;


-- Un contador es de solo lectura y es el canal del plan Contador: no gasta cupo de «personas con acceso» del
-- hogar cliente (si no, un hogar Gratis de 2 personas nunca podría tener contador).
create or replace function private.personas_ocupadas(h uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.members where household_id = h and user_id is not null and rol <> 'contador')::int
       + (select count(*) from public.invitations
           where household_id = h and rol <> 'contador' and aceptada_en is null and expira_en > now())::int
$$;

create or replace function private.limite_personas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tope int;
  ocupadas int;
begin
  if (select auth.uid()) is null or new.rol = 'contador' then
    return new;
  end if;
  tope := private.limite_num(new.household_id, 'personas')::int;
  if tope is null then
    return new;
  end if;
  if tg_table_name = 'invitations' then
    ocupadas := private.personas_ocupadas(new.household_id);
  elsif new.user_id is not null then
    select count(*) into ocupadas from public.members
     where household_id = new.household_id and user_id is not null and rol <> 'contador';
  else
    return new; -- dependientes sin acceso: no cuentan
  end if;
  if ocupadas >= tope then
    raise exception 'Tu plan % permite % personas con acceso. Mejora tu plan para sumar a alguien más.',
      private.nombre_plan(new.household_id), tope;
  end if;
  return new;
end $$;

-- hogar_activo entra a la lista de tablas que nadie toca por la API.
create or replace function public.revision_seguridad() returns table (tipo text, objeto text)
language sql stable security definer set search_path = '' as $$
  select 'tabla_sin_rls', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select 'vista_sin_security_invoker', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any (c.reloptions) or 'security_invoker=on' = any (c.reloptions), false)
  union all
  select 'funcion_publica_para_anon', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('ver_invitacion', 'consola_ver_invitacion')
  union all
  select 'definer_sin_search_path', n.nspname || '.' || p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)
  union all
  select 'funcion_de_servidor_expuesta', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname in ('registrar_pago_wompi', 'procesar_vencimientos', 'integracion_leer', 'integracion_evento',
                       'correos_de_usuarios', 'revision_seguridad', 'custom_access_token_hook', 'campana_hogares')
  union all
  select 'tabla_sensible_accesible', t || ' (' || r || ')'
    from unnest(array['auditoria', 'integraciones', 'staff_invitaciones', 'eventos_pasarela', 'cupones', 'cupones_usos',
                      'hogar_notas', 'avisos_enviados', 'eventos', 'correos_enviados', 'campanas', 'hogar_activo']) t
   cross join unnest(array['anon', 'authenticated']) r
   where has_table_privilege(r, 'public.' || t, 'select') or has_table_privilege(r, 'public.' || t, 'insert')
      or has_table_privilege(r, 'public.' || t, 'update') or has_table_privilege(r, 'public.' || t, 'delete')
  union all
  select 'bucket_publico', b.id from storage.buckets b where b.public
$$;
revoke execute on function public.revision_seguridad() from public, anon, authenticated;
grant execute on function public.revision_seguridad() to service_role;

do $$
declare
  f text;
begin
  foreach f in array array['elegir_hogar(uuid)', 'mis_hogares_lista()', 'mis_clientes()', 'mi_firma()', 'obtener_ref(uuid)',
                           'consola_contadores()', 'consola_verificar_contador(uuid, boolean)',
                           'consola_liquidar_comisiones(date)', 'consola_marcar_comision(uuid, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
