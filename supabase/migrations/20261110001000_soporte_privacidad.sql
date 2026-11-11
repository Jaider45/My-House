-- SaaS S7: soporte (tickets y registro técnico), acceso de soporte con permiso del hogar y solicitudes de la Ley 1581.

-- ═════════════════════════════ Días hábiles en Colombia ═════════════════════════════
-- Domingo de Pascua (algoritmo gregoriano anónimo).
create function private.pascua(anio int) returns date
language plpgsql immutable set search_path = '' as $$
declare
  a int := anio % 19; b int := anio / 100; c int := anio % 100; d int := b / 4; e int := b % 4;
  f int := (b + 8) / 25; g int := (b - f + 1) / 3; h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4; k int := c % 4; l int := (32 + 2 * e + 2 * i - h - k) % 7; m int := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(anio, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end $$;

-- Festivos de Colombia (Ley 51 de 1983, «ley Emiliani»: varios se corren al lunes siguiente).
create function private.festivos_co(anio int) returns setof date
language sql immutable set search_path = '' as $$
  with p as (select private.pascua(anio) as e),
  lunes(d) as (select d + ((8 - extract(isodow from d)::int) % 7) from unnest(array[
    make_date(anio, 1, 6), make_date(anio, 3, 19), make_date(anio, 6, 29), make_date(anio, 8, 15),
    make_date(anio, 10, 12), make_date(anio, 11, 1), make_date(anio, 11, 11)]) d)
  select unnest(array[make_date(anio, 1, 1), make_date(anio, 5, 1), make_date(anio, 7, 20), make_date(anio, 8, 7),
                      make_date(anio, 12, 8), make_date(anio, 12, 25)])
  union select d from lunes
  union select e - 3 from p            -- Jueves Santo
  union select e - 2 from p            -- Viernes Santo
  union select e + 43 from p           -- Ascensión (lunes)
  union select e + 64 from p           -- Corpus Christi (lunes)
  union select e + 71 from p           -- Sagrado Corazón (lunes)
$$;

-- `n` días hábiles después de `desde` (no cuenta el día de recibo; ni sábados, domingos ni festivos).
create function private.sumar_habiles(desde date, n int) returns date
language plpgsql stable set search_path = '' as $$
declare
  d date := desde;
  faltan int := n;
begin
  while faltan > 0 loop
    d := d + 1;
    if extract(isodow from d) < 6 and d not in (select private.festivos_co(extract(year from d)::int)) then
      faltan := faltan - 1;
    end if;
  end loop;
  return d;
end $$;

-- ═════════════════════════════ Tickets ═════════════════════════════
create table public.tickets (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint generated always as identity unique,
  household_id      uuid references public.households on delete cascade,
  creado_por        uuid references auth.users on delete set null,
  creado_nombre     text not null,
  asunto            text not null check (char_length(btrim(asunto)) between 3 and 120),
  categoria         text not null default 'otro' check (categoria in ('cuenta', 'cobros', 'importacion', 'ia', 'renta', 'otro')),
  prioridad         text not null default 'normal' check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  estado            text not null default 'abierto' check (estado in ('abierto', 'esperando_cliente', 'resuelto')),
  asignado_a        uuid references auth.users on delete set null,
  escalado          boolean not null default false,
  sla_vence         timestamptz not null,           -- primera respuesta del equipo
  primera_respuesta timestamptz,
  ultimo_mensaje    timestamptz not null default now(),
  resuelto_en       timestamptz,
  created_at        timestamptz not null default now()
);
create index tickets_estado_idx on public.tickets (estado, sla_vence);
create index tickets_hogar_idx on public.tickets (household_id);

create table public.ticket_mensajes (
  id           bigint generated always as identity primary key,
  ticket_id    uuid not null references public.tickets on delete cascade,
  autor        uuid references auth.users on delete set null,
  autor_nombre text not null,
  de_equipo    boolean not null,
  interno      boolean not null default false,   -- nota interna: solo el equipo la ve
  cuerpo       text not null check (char_length(btrim(cuerpo)) between 1 and 5000),
  created_at   timestamptz not null default now()
);
create index ticket_mensajes_ticket_idx on public.ticket_mensajes (ticket_id, id);

create table public.respuestas_guardadas (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null check (char_length(btrim(titulo)) between 2 and 80),
  cuerpo     text not null check (char_length(btrim(cuerpo)) between 2 and 5000),
  updated_at timestamptz not null default now()
);

alter table public.tickets enable row level security;
alter table public.ticket_mensajes enable row level security;
alter table public.respuestas_guardadas enable row level security;
-- Quien escribió ve su ticket (no el resto del hogar: puede ser algo personal). Se escribe solo por funciones.
create policy tickets_propios on public.tickets for select to authenticated using (creado_por = (select auth.uid()));
create policy mensajes_propios on public.ticket_mensajes for select to authenticated
  using (not interno and ticket_id in (select id from public.tickets where creado_por = (select auth.uid())));
revoke insert, update, delete, truncate on public.tickets, public.ticket_mensajes from anon, authenticated;
revoke all on public.respuestas_guardadas from anon, authenticated;

create function private.sla_de(p text) returns interval
language sql immutable set search_path = '' as $$
  select case p when 'urgente' then interval '4 hours' when 'alta' then interval '8 hours'
                when 'baja' then interval '72 hours' else interval '24 hours' end
$$;

create function public.crear_ticket(p_hogar uuid, p_asunto text, p_categoria text, p_cuerpo text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
  nombre text;
  v_id uuid;
  prio text;
begin
  select m.nombre into nombre from public.members m where m.household_id = p_hogar and m.user_id = yo;
  if yo is null or nombre is null then
    raise exception 'No perteneces a ese hogar.' using errcode = '42501';
  end if;
  if (select count(*) from public.tickets where creado_por = yo and estado <> 'resuelto') >= 5 then
    raise exception 'Tienes 5 solicitudes abiertas: espera respuesta o cierra alguna antes de abrir otra.';
  end if;
  if (select count(*) from public.tickets where creado_por = yo and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al límite de solicitudes por hoy.';
  end if;
  if char_length(btrim(coalesce(p_cuerpo, ''))) not between 5 and 5000 then
    raise exception 'Cuéntanos qué pasó (entre 5 y 5000 caracteres).';
  end if;
  -- Los cobros y el acceso a la cuenta van primero: alguien no puede pagar o no puede entrar.
  prio := case when p_categoria in ('cobros', 'cuenta') then 'alta' else 'normal' end;
  insert into public.tickets (household_id, creado_por, creado_nombre, asunto, categoria, prioridad, sla_vence)
  values (p_hogar, yo, nombre, btrim(p_asunto), coalesce(nullif(p_categoria, ''), 'otro'), prio, now() + private.sla_de(prio))
  returning id into v_id;
  insert into public.ticket_mensajes (ticket_id, autor, autor_nombre, de_equipo, cuerpo) values (v_id, yo, nombre, false, btrim(p_cuerpo));
  return v_id;
end $$;

-- Responder (reabre si estaba resuelto o esperando) o cerrar (`p_cuerpo` null + `p_cerrar`).
create function public.responder_ticket(p_ticket uuid, p_cuerpo text, p_cerrar boolean default false) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  t public.tickets;
begin
  select * into t from public.tickets where id = p_ticket and creado_por = auth.uid() for update;
  if t.id is null then
    raise exception 'Esa solicitud no existe.' using errcode = '42501';
  end if;
  if p_cuerpo is not null and btrim(p_cuerpo) <> '' then
    if char_length(p_cuerpo) > 5000 then
      raise exception 'El mensaje es muy largo.';
    end if;
    insert into public.ticket_mensajes (ticket_id, autor, autor_nombre, de_equipo, cuerpo) values (t.id, auth.uid(), t.creado_nombre, false, btrim(p_cuerpo));
  end if;
  update public.tickets
     set estado = case when p_cerrar then 'resuelto' else 'abierto' end,
         resuelto_en = case when p_cerrar then now() end,
         ultimo_mensaje = now()
   where id = t.id;
end $$;

-- Errores técnicos del hogar (importación, IA, correo) para que soporte entienda qué pasó. Sin montos.
create table public.registro_tecnico (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid references auth.users on delete set null,
  tipo         text not null check (tipo in ('importacion', 'ia', 'correo', 'otro')),
  mensaje      text not null check (char_length(mensaje) <= 500),
  detalle      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index registro_tecnico_hogar_idx on public.registro_tecnico (household_id, id desc);
alter table public.registro_tecnico enable row level security;
revoke all on public.registro_tecnico from anon, authenticated;

create function public.registrar_error(p_hogar uuid, p_tipo text, p_mensaje text, p_detalle jsonb default '{}'::jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_hogar not in (select private.mis_hogares()) then
    return; -- nunca rompe a quien lo llama
  end if;
  if (select count(*) from public.registro_tecnico where household_id = p_hogar and created_at > now() - interval '1 day') >= 200 then
    return;
  end if;
  insert into public.registro_tecnico (household_id, user_id, tipo, mensaje, detalle)
  values (p_hogar, auth.uid(), case when p_tipo in ('importacion', 'ia', 'correo') then p_tipo else 'otro' end,
          left(coalesce(p_mensaje, ''), 500),
          case when jsonb_typeof(p_detalle) = 'object' and length(p_detalle::text) <= 2000 then p_detalle else '{}'::jsonb end);
end $$;

-- ── Consola: soporte (permiso tickets) ──
create function public.consola_tickets(p_estado text, p_asignado text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('tickets');
begin
  return jsonb_build_object(
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', t.id, 'numero', t.numero, 'asunto', t.asunto, 'categoria', t.categoria, 'prioridad', t.prioridad,
                  'estado', t.estado, 'escalado', t.escalado, 'sla_vence', t.sla_vence, 'primera_respuesta', t.primera_respuesta,
                  'ultimo_mensaje', t.ultimo_mensaje, 'created_at', t.created_at, 'creado_nombre', t.creado_nombre,
                  'hogar', h.nombre, 'plan', h.plan, 'asignado', ps.nombre)
                  order by case t.prioridad when 'urgente' then 0 when 'alta' then 1 when 'normal' then 2 else 3 end, t.sla_vence), '[]'::jsonb)
                  from public.tickets t
                  left join public.households h on h.id = t.household_id
                  left join public.platform_staff ps on ps.user_id = t.asignado_a
                 where (p_estado is null or p_estado = '' or t.estado = p_estado or (p_estado = 'pendientes' and t.estado <> 'resuelto'))
                   and (p_asignado is distinct from 'mios' or t.asignado_a = s.user_id)),
    'conteos', (select jsonb_build_object(
                  'abiertos', count(*) filter (where estado <> 'resuelto'),
                  'urgentes', count(*) filter (where estado <> 'resuelto' and prioridad = 'urgente'),
                  'vencidos', count(*) filter (where estado = 'abierto' and primera_respuesta is null and sla_vence < now()),
                  'mios', count(*) filter (where estado <> 'resuelto' and asignado_a = s.user_id),
                  'resueltos_7d', count(*) filter (where resuelto_en > now() - interval '7 days'))
                  from public.tickets),
    'respuestas', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'cuerpo', r.cuerpo) order by r.titulo), '[]'::jsonb)
                     from public.respuestas_guardadas r),
    'equipo', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nombre', p.nombre) order by p.nombre), '[]'::jsonb)
                 from public.platform_staff p where p.activo and 'tickets' = any (private.permisos_de_rol(p.rol))));
end $$;

create function public.consola_ticket(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.tickets;
begin
  perform private.exigir_staff('tickets');
  select * into t from public.tickets where id = p_id;
  if t.id is null then
    raise exception 'Ese ticket no existe.';
  end if;
  return jsonb_build_object(
    'ticket', to_jsonb(t) || jsonb_build_object('asignado', (select nombre from public.platform_staff where user_id = t.asignado_a)),
    'mensajes', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'autor_nombre', m.autor_nombre, 'de_equipo', m.de_equipo,
                   'interno', m.interno, 'cuerpo', m.cuerpo, 'created_at', m.created_at) order by m.id), '[]'::jsonb)
                   from public.ticket_mensajes m where m.ticket_id = t.id),
    'hogar', (select jsonb_build_object('id', h.id, 'nombre', h.nombre, 'plan', h.plan, 'estado', h.estado, 'created_at', h.created_at,
                     'miembros', (select count(*) from public.members m where m.household_id = h.id and m.user_id is not null))
                from public.households h where h.id = t.household_id),
    'registro', (select coalesce(jsonb_agg(jsonb_build_object('tipo', r.tipo, 'mensaje', r.mensaje, 'detalle', r.detalle, 'created_at', r.created_at)
                   order by r.id desc), '[]'::jsonb)
                   from (select * from public.registro_tecnico where household_id = t.household_id order by id desc limit 20) r),
    'otros', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'numero', o.numero, 'asunto', o.asunto, 'estado', o.estado) order by o.numero desc), '[]'::jsonb)
                from public.tickets o where o.household_id = t.household_id and o.id <> t.id));
end $$;

-- Respuesta al cliente o nota interna. Devuelve el correo de quien escribió para avisarle (solo si no es interna).
create function public.consola_responder_ticket(p_id uuid, p_cuerpo text, p_interno boolean, p_estado text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('tickets');
  t public.tickets;
begin
  select * into t from public.tickets where id = p_id for update;
  if t.id is null then
    raise exception 'Ese ticket no existe.';
  end if;
  if char_length(btrim(coalesce(p_cuerpo, ''))) not between 1 and 5000 then
    raise exception 'Escribe la respuesta.';
  end if;
  insert into public.ticket_mensajes (ticket_id, autor, autor_nombre, de_equipo, interno, cuerpo)
  values (t.id, s.user_id, s.nombre, true, coalesce(p_interno, false), btrim(p_cuerpo));
  if not coalesce(p_interno, false) then
    update public.tickets
       set primera_respuesta = coalesce(primera_respuesta, now()),
           estado = case when p_estado in ('abierto', 'esperando_cliente', 'resuelto') then p_estado else 'esperando_cliente' end,
           resuelto_en = case when p_estado = 'resuelto' then now() end,
           asignado_a = coalesce(asignado_a, s.user_id),
           ultimo_mensaje = now()
     where id = t.id;
    perform private.auditar(s.user_id, s.nombre, 'respondio_ticket', 'ticket', t.id::text, '#' || t.numero || ' ' || t.asunto, '{}'::jsonb);
    return (select email from auth.users where id = t.creado_por);
  end if;
  return null;
end $$;

create function public.consola_actualizar_ticket(p_id uuid, p_prioridad text, p_asignado uuid, p_escalado boolean, p_estado text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('tickets');
  t public.tickets;
begin
  select * into t from public.tickets where id = p_id for update;
  if t.id is null then
    raise exception 'Ese ticket no existe.';
  end if;
  if p_prioridad not in ('baja', 'normal', 'alta', 'urgente') or p_estado not in ('abierto', 'esperando_cliente', 'resuelto') then
    raise exception 'Valor no válido.';
  end if;
  if p_asignado is not null and not exists (select 1 from public.platform_staff where user_id = p_asignado and activo) then
    raise exception 'Esa persona no está en el equipo.';
  end if;
  update public.tickets
     set prioridad = p_prioridad, asignado_a = p_asignado, escalado = coalesce(p_escalado, false), estado = p_estado,
         -- Subir la prioridad antes de responder acorta el plazo de primera respuesta.
         sla_vence = case when primera_respuesta is null and p_prioridad <> t.prioridad then created_at + private.sla_de(p_prioridad) else sla_vence end,
         resuelto_en = case when p_estado = 'resuelto' then coalesce(resuelto_en, now()) end
   where id = t.id;
  perform private.auditar(s.user_id, s.nombre, 'actualizo_ticket', 'ticket', t.id::text, '#' || t.numero || ' ' || t.asunto,
    jsonb_build_object('prioridad', p_prioridad, 'estado', p_estado, 'escalado', p_escalado, 'asignado', p_asignado));
end $$;

create function public.consola_guardar_respuesta(p_id uuid, p_titulo text, p_cuerpo text, p_borrar boolean default false) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.exigir_staff('tickets');
  if p_borrar then
    delete from public.respuestas_guardadas where id = p_id;
  elsif p_id is null then
    insert into public.respuestas_guardadas (titulo, cuerpo) values (btrim(p_titulo), btrim(p_cuerpo));
  else
    update public.respuestas_guardadas set titulo = btrim(p_titulo), cuerpo = btrim(p_cuerpo), updated_at = now() where id = p_id;
  end if;
end $$;

-- ═════════════════════════════ Acceso de soporte con permiso ═════════════════════════════
-- Nadie del equipo ve las finanzas de un hogar sin que su administrador lo apruebe; vence solo y cada vista se audita.
create table public.accesos_soporte (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  staff_id       uuid not null references auth.users on delete cascade,
  staff_nombre   text not null,
  motivo         text not null check (char_length(btrim(motivo)) between 10 and 300),
  horas          int not null default 24 check (horas between 1 and 72),
  estado         text not null default 'pedido' check (estado in ('pedido', 'aprobado', 'rechazado', 'revocado')),
  pedido_en      timestamptz not null default now(),
  respondido_por uuid references auth.users on delete set null,
  respondido_en  timestamptz,
  vence          timestamptz
);
create index accesos_soporte_hogar_idx on public.accesos_soporte (household_id, estado);
alter table public.accesos_soporte enable row level security;
-- El administrador del hogar ve las solicitudes y accesos de su hogar (para aprobar o revocar).
create policy accesos_admin on public.accesos_soporte for select to authenticated using (private.tiene_rol(household_id, '{admin}'));
revoke insert, update, delete, truncate on public.accesos_soporte from anon, authenticated;

create function private.acceso_vigente(p_hogar uuid, p_staff uuid) returns public.accesos_soporte
language sql stable security definer set search_path = '' as $$
  select * from public.accesos_soporte
   where household_id = p_hogar and staff_id = p_staff and estado = 'aprobado' and vence > now()
   order by vence desc limit 1
$$;

-- Devuelve los correos de los administradores para avisarles (solo los usa el servidor).
create function public.consola_pedir_acceso(p_hogar uuid, p_motivo text, p_horas int) returns text[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('ver_finanzas');
  h public.households;
begin
  select * into h from public.households where id = p_hogar;
  if h.id is null then
    raise exception 'Ese hogar no existe.';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) not between 10 and 300 then
    raise exception 'Explica el motivo (es lo que verá el administrador del hogar).';
  end if;
  if exists (select 1 from public.accesos_soporte where household_id = p_hogar and staff_id = s.user_id
              and (estado = 'pedido' or (estado = 'aprobado' and vence > now()))) then
    raise exception 'Ya tienes una solicitud pendiente o un acceso vigente a este hogar.';
  end if;
  insert into public.accesos_soporte (household_id, staff_id, staff_nombre, motivo, horas)
  values (p_hogar, s.user_id, s.nombre, btrim(p_motivo), coalesce(p_horas, 24));
  perform private.auditar(s.user_id, s.nombre, 'pidio_acceso_finanzas', 'hogar', p_hogar::text, h.nombre,
                          jsonb_build_object('motivo', btrim(p_motivo), 'horas', p_horas));
  return array(select u.email::text from public.members m join auth.users u on u.id = m.user_id
                where m.household_id = p_hogar and m.rol = 'admin');
end $$;

-- El administrador aprueba o rechaza; también revoca un acceso vigente.
create function public.responder_acceso_soporte(p_id uuid, p_accion text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.accesos_soporte;
begin
  select * into a from public.accesos_soporte where id = p_id for update;
  if a.id is null or not private.tiene_rol(a.household_id, '{admin}') then
    raise exception 'Solo el administrador del hogar responde esta solicitud.' using errcode = '42501';
  end if;
  if p_accion in ('aprobar', 'rechazar') and a.estado <> 'pedido' then
    raise exception 'Esa solicitud ya se respondió.';
  end if;
  if p_accion = 'revocar' and not (a.estado = 'aprobado' and a.vence > now()) then
    raise exception 'Ese acceso ya no está vigente.';
  end if;
  update public.accesos_soporte
     set estado = case p_accion when 'aprobar' then 'aprobado' when 'rechazar' then 'rechazado' when 'revocar' then 'revocado' else estado end,
         vence = case when p_accion = 'aprobar' then now() + make_interval(hours => a.horas) when p_accion = 'revocar' then now() else vence end,
         respondido_por = auth.uid(), respondido_en = now()
   where id = a.id;
  perform private.auditar(auth.uid(), 'Administrador del hogar', p_accion || '_acceso_finanzas', 'hogar', a.household_id::text, a.staff_nombre,
                          jsonb_build_object('acceso', a.id));
end $$;

create function public.consola_accesos(p_hogar uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('ver_hogares');
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'staff_nombre', a.staff_nombre, 'motivo', a.motivo, 'horas', a.horas,
            'estado', case when a.estado = 'aprobado' and a.vence <= now() then 'vencido' else a.estado end, 'pedido_en', a.pedido_en,
            'vence', a.vence, 'mio', a.staff_id = s.user_id) order by a.pedido_en desc), '[]'::jsonb)
            from public.accesos_soporte a where a.household_id = p_hogar);
end $$;

-- Datos financieros de un hogar: solo con acceso aprobado y vigente de quien consulta. Cada lectura se audita.
create function public.consola_ver_finanzas(p_hogar uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('ver_finanzas');
  a public.accesos_soporte := private.acceso_vigente(p_hogar, s.user_id);
begin
  if a.id is null then
    raise exception 'No tienes permiso del hogar para ver sus datos financieros (o ya venció).';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'vio_finanzas', 'hogar', p_hogar::text, (select nombre from public.households where id = p_hogar),
                          jsonb_build_object('acceso', a.id));
  return jsonb_build_object(
    'vence', a.vence,
    'cuentas', (select coalesce(jsonb_agg(jsonb_build_object('nombre', c.nombre, 'tipo', c.tipo, 'archivada', c.archivada, 'saldo', b.saldo) order by c.created_at), '[]'::jsonb)
                  from public.accounts c left join public.account_balances b on b.account_id = c.id where c.household_id = p_hogar),
    'movimientos', (select coalesce(jsonb_agg(jsonb_build_object('fecha', x.fecha, 'comercio', x.comercio, 'monto', x.monto, 'tipo', x.tipo, 'estado', x.estado,
                      'origen', x.origen, 'categoria', x.categoria, 'cuenta', x.cuenta) order by x.fecha desc, x.created_at desc), '[]'::jsonb)
                      from (select t.fecha, t.comercio, t.monto, t.tipo, t.estado, t.origen, t.created_at, c.nombre as categoria, ac.nombre as cuenta
                              from public.transactions t
                              left join public.categories c on c.id = t.category_id
                              left join public.accounts ac on ac.id = t.account_id
                             where t.household_id = p_hogar order by t.fecha desc, t.created_at desc limit 100) x),
    'importaciones', (select coalesce(jsonb_agg(jsonb_build_object('archivo', i.archivo_nombre, 'total', i.filas_total, 'importadas', i.filas_importadas,
                        'duplicadas', i.filas_duplicadas, 'created_at', i.created_at) order by i.created_at desc), '[]'::jsonb)
                        from (select * from public.import_batches where household_id = p_hogar order by created_at desc limit 10) i));
end $$;

-- ═════════════════════════════ Ley 1581: solicitudes de titulares ═════════════════════════════
-- Consulta: 10 días hábiles. Reclamo (supresión, actualización, revocatoria): 15 días hábiles (arts. 14 y 15).
create table public.solicitudes_privacidad (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity unique,
  tipo           text not null check (tipo in ('consulta', 'actualizacion', 'supresion', 'revocatoria', 'reclamo')),
  titular_user   uuid references auth.users on delete set null,
  titular_correo text not null check (char_length(titular_correo) between 3 and 200),
  titular_nombre text,
  canal          text not null default 'app' check (canal in ('app', 'correo')),
  detalle        text check (char_length(detalle) <= 2000),
  estado         text not null default 'recibida' check (estado in ('recibida', 'en_tramite', 'resuelta', 'rechazada')),
  recibida       date not null default private.hoy(),
  vence          date not null,
  respuesta      text check (char_length(respuesta) <= 4000),
  atendida_por   uuid references auth.users on delete set null,
  resuelta_en    timestamptz,
  exportada_en   timestamptz,
  suprimida_en   timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.solicitudes_privacidad enable row level security;
create policy solicitudes_propias on public.solicitudes_privacidad for select to authenticated using (titular_user = (select auth.uid()));
revoke insert, update, delete, truncate on public.solicitudes_privacidad from anon, authenticated;

create function private.plazo_1581(p_tipo text, p_recibida date) returns date
language sql stable set search_path = '' as $$
  select private.sumar_habiles(p_recibida, case when p_tipo = 'consulta' then 10 else 15 end)
$$;

-- El titular la hace desde la app (Ayuda → Tus datos).
create function public.solicitar_privacidad(p_tipo text, p_detalle text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
  v_id uuid;
begin
  if yo is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if p_tipo not in ('consulta', 'actualizacion', 'supresion', 'revocatoria', 'reclamo') then
    raise exception 'Tipo de solicitud no válido.';
  end if;
  if exists (select 1 from public.solicitudes_privacidad where titular_user = yo and tipo = p_tipo and estado in ('recibida', 'en_tramite')) then
    raise exception 'Ya tienes una solicitud de ese tipo en trámite.';
  end if;
  insert into public.solicitudes_privacidad (tipo, titular_user, titular_correo, titular_nombre, canal, detalle, vence)
  select p_tipo, yo, u.email, (select m.nombre from public.members m where m.user_id = yo order by m.created_at limit 1), 'app',
         nullif(left(btrim(coalesce(p_detalle, '')), 2000), ''), private.plazo_1581(p_tipo, private.hoy())
    from auth.users u where u.id = yo
  returning id into v_id;
  return v_id;
end $$;

create function public.consola_solicitudes_privacidad() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('auditoria');
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'numero', s.numero, 'tipo', s.tipo, 'titular_correo', s.titular_correo, 'titular_nombre', s.titular_nombre,
            'canal', s.canal, 'detalle', s.detalle, 'estado', s.estado, 'recibida', s.recibida, 'vence', s.vence, 'respuesta', s.respuesta,
            'resuelta_en', s.resuelta_en, 'exportada_en', s.exportada_en, 'suprimida_en', s.suprimida_en, 'tiene_cuenta', s.titular_user is not null,
            'dias_habiles_restantes', case when s.estado in ('recibida', 'en_tramite')
              then (select count(*) from generate_series(private.hoy() + 1, s.vence, interval '1 day') g(d)
                     where extract(isodow from g.d) < 6 and g.d::date not in (select private.festivos_co(extract(year from g.d)::int))) end)
            order by (s.estado in ('recibida', 'en_tramite')) desc, s.vence, s.numero desc), '[]'::jsonb)
            from public.solicitudes_privacidad s);
end $$;

-- Una solicitud que llegó por correo (datos@…): el plazo corre desde que se recibió.
create function public.consola_registrar_solicitud(p_tipo text, p_correo text, p_nombre text, p_detalle text, p_recibida date) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('auditoria');
  v_id uuid;
  rec date := coalesce(p_recibida, private.hoy());
begin
  if p_tipo not in ('consulta', 'actualizacion', 'supresion', 'revocatoria', 'reclamo') then
    raise exception 'Tipo de solicitud no válido.';
  end if;
  if coalesce(p_correo, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Escribe el correo del titular.';
  end if;
  if rec > private.hoy() or rec < private.hoy() - 60 then
    raise exception 'La fecha de recibo debe ser de los últimos 60 días.';
  end if;
  insert into public.solicitudes_privacidad (tipo, titular_user, titular_correo, titular_nombre, canal, detalle, recibida, vence)
  values (p_tipo, (select id from auth.users where lower(email) = lower(btrim(p_correo)) limit 1), lower(btrim(p_correo)),
          nullif(btrim(coalesce(p_nombre, '')), ''), 'correo', nullif(left(btrim(coalesce(p_detalle, '')), 2000), ''), rec,
          private.plazo_1581(p_tipo, rec))
  returning id into v_id;
  perform private.auditar(s.user_id, s.nombre, 'registro_solicitud_1581', 'solicitud', v_id::text, p_tipo, jsonb_build_object('recibida', rec));
  return v_id;
end $$;

create function public.consola_responder_solicitud(p_id uuid, p_estado text, p_respuesta text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('auditoria');
  sol public.solicitudes_privacidad;
begin
  select * into sol from public.solicitudes_privacidad where id = p_id for update;
  if sol.id is null then
    raise exception 'Esa solicitud no existe.';
  end if;
  if p_estado not in ('en_tramite', 'resuelta', 'rechazada') then
    raise exception 'Estado no válido.';
  end if;
  if p_estado in ('resuelta', 'rechazada') and char_length(btrim(coalesce(p_respuesta, ''))) < 10 then
    raise exception 'Escribe la respuesta al titular (queda como constancia).';
  end if;
  update public.solicitudes_privacidad
     set estado = p_estado, respuesta = coalesce(nullif(btrim(coalesce(p_respuesta, '')), ''), respuesta), atendida_por = s.user_id,
         resuelta_en = case when p_estado in ('resuelta', 'rechazada') then now() end
   where id = sol.id;
  perform private.auditar(s.user_id, s.nombre, 'respondio_solicitud_1581', 'solicitud', sol.id::text, sol.tipo || ' #' || sol.numero,
                          jsonb_build_object('estado', p_estado));
  return sol.titular_correo;
end $$;

-- Exportación de los datos del titular: perfil, membresías y los datos de cada hogar al que pertenece.
create function public.consola_exportar_titular(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('auditoria');
  sol public.solicitudes_privacidad;
  hogares uuid[];
begin
  select * into sol from public.solicitudes_privacidad where id = p_id for update;
  if sol.id is null or sol.titular_user is null then
    raise exception 'La solicitud no tiene una cuenta asociada para exportar.';
  end if;
  hogares := array(select household_id from public.members where user_id = sol.titular_user);
  update public.solicitudes_privacidad set exportada_en = now(), estado = case when estado = 'recibida' then 'en_tramite' else estado end where id = sol.id;
  perform private.auditar(s.user_id, s.nombre, 'exporto_datos_titular', 'solicitud', sol.id::text, sol.titular_correo,
                          jsonb_build_object('hogares', cardinality(hogares)));
  return jsonb_build_object(
    'generado', now(),
    'titular', (select jsonb_build_object('correo', u.email, 'creado', u.created_at, 'ultimo_ingreso', u.last_sign_in_at) from auth.users u where u.id = sol.titular_user),
    'membresias', (select coalesce(jsonb_agg(jsonb_build_object('hogar', h.nombre, 'rol', m.rol, 'nombre', m.nombre, 'desde', m.created_at)), '[]'::jsonb)
                     from public.members m join public.households h on h.id = m.household_id where m.user_id = sol.titular_user),
    'hogares', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', h.id, 'nombre', h.nombre, 'pais', h.pais, 'plan', h.plan, 'creado', h.created_at,
                  'miembros', (select jsonb_agg(jsonb_build_object('nombre', m.nombre, 'rol', m.rol, 'parentesco', m.parentesco, 'fecha_nacimiento', m.fecha_nacimiento)) from public.members m where m.household_id = h.id),
                  'cuentas', (select coalesce(jsonb_agg(to_jsonb(c) - 'household_id' - 'mapeo_csv'), '[]'::jsonb) from public.accounts c where c.household_id = h.id),
                  'categorias', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'padre_id', c.padre_id, 'clase', c.clase)), '[]'::jsonb) from public.categories c where c.household_id = h.id),
                  'movimientos', (select coalesce(jsonb_agg(to_jsonb(t) - 'household_id' - 'import_hash' order by t.fecha), '[]'::jsonb) from public.transactions t where t.household_id = h.id),
                  'pagos_fijos', (select coalesce(jsonb_agg(to_jsonb(r) - 'household_id'), '[]'::jsonb) from public.recurring_rules r where r.household_id = h.id),
                  'presupuestos_y_metas', (select coalesce(jsonb_agg(to_jsonb(b) - 'household_id'), '[]'::jsonb) from public.budgets_goals b where b.household_id = h.id),
                  'deudas', (select coalesce(jsonb_agg(to_jsonb(d) - 'household_id'), '[]'::jsonb) from public.debts d where d.household_id = h.id),
                  'recordatorios', (select coalesce(jsonb_agg(to_jsonb(r) - 'household_id'), '[]'::jsonb) from public.reminders r where r.household_id = h.id),
                  'soportes', (select coalesce(jsonb_agg(jsonb_build_object('archivo', a.archivo_path, 'tipo', a.tipo, 'movimiento', a.transaction_id)), '[]'::jsonb) from public.attachments a where a.household_id = h.id),
                  'cobros', (select coalesce(jsonb_agg(jsonb_build_object('fecha', c.creado, 'monto', c.monto, 'estado', c.estado, 'pagado_en', c.pagado_en)), '[]'::jsonb) from public.cobros c where c.household_id = h.id))), '[]'::jsonb)
                from public.households h where h.id = any (hogares)),
    'solicitudes', (select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'recibida', x.recibida, 'estado', x.estado)), '[]'::jsonb)
                      from public.solicitudes_privacidad x where x.titular_user = sol.titular_user));
end $$;

-- La supresión retira a la persona de los hogares compartidos (user_id → null). Solo se permite dentro de una función
-- de la base (corre como su dueño); por la API nadie cambia el usuario de un miembro.
create or replace function private.proteger_miembro() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id and not (new.user_id is null and current_user = 'postgres') then
    raise exception 'no se puede cambiar el usuario de un miembro';
  end if;
  if old.user_id = (select auth.uid()) and new.rol is distinct from old.rol then
    raise exception 'no puede cambiar su propio rol';
  end if;
  return new;
end $$;

-- Supresión: hogares donde el titular es la única persona con cuenta se borran completos (cascada); en los compartidos
-- se retira su acceso y sus datos personales. Devuelve lo que el servidor debe limpiar fuera de la base (archivos y
-- la cuenta de Auth). Con `p_ejecutar = false` solo informa qué pasaría.
create function public.consola_supresion(p_id uuid, p_ejecutar boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('auditoria');
  sol public.solicitudes_privacidad;
  borrar uuid[];
  compartidos uuid[];
  es_staff boolean;
begin
  select * into sol from public.solicitudes_privacidad where id = p_id for update;
  if sol.id is null or sol.tipo <> 'supresion' then
    raise exception 'Solo una solicitud de supresión se ejecuta.';
  end if;
  if sol.suprimida_en is not null then
    raise exception 'Esta supresión ya se ejecutó.';
  end if;
  borrar := array(select m.household_id from public.members m where m.user_id = sol.titular_user
                   and not exists (select 1 from public.members o where o.household_id = m.household_id and o.user_id is not null and o.user_id <> sol.titular_user));
  compartidos := array(select m.household_id from public.members m where m.user_id = sol.titular_user and not (m.household_id = any (borrar)));
  es_staff := exists (select 1 from public.platform_staff where user_id = sol.titular_user);
  if p_ejecutar then
    if sol.titular_user is null then
      raise exception 'La solicitud no tiene una cuenta asociada.';
    end if;
    if es_staff then
      raise exception 'Esa cuenta pertenece al equipo: primero retírala en Equipo y permisos.';
    end if;
    delete from public.households where id = any (borrar);
    update public.members set user_id = null, nombre = 'Persona retirada', nit_digitos = null, fecha_nacimiento = null, nota = null
     where user_id = sol.titular_user;
    -- Un hogar compartido no se queda sin administrador: pasa a la persona con cuenta más antigua (no al contador).
    update public.members set rol = 'admin' where id in (
      select distinct on (o.household_id) o.id from public.members o
       where o.household_id = any (compartidos) and o.user_id is not null and o.rol <> 'contador'
         and not exists (select 1 from public.members a where a.household_id = o.household_id and a.rol = 'admin' and a.user_id is not null)
       order by o.household_id, o.created_at);
    delete from public.hogar_activo where user_id = sol.titular_user;
    update public.solicitudes_privacidad set suprimida_en = now(), estado = 'resuelta', resuelta_en = now(), atendida_por = s.user_id,
           respuesta = coalesce(respuesta, 'Datos suprimidos: hogares propios eliminados, acceso retirado de los compartidos y cuenta cerrada.')
     where id = sol.id;
    perform private.auditar(s.user_id, s.nombre, 'ejecuto_supresion', 'solicitud', sol.id::text, sol.titular_correo,
                            jsonb_build_object('hogares_borrados', cardinality(borrar), 'hogares_compartidos', cardinality(compartidos)));
  end if;
  return jsonb_build_object('user_id', sol.titular_user, 'borrar', to_jsonb(borrar), 'compartidos', to_jsonb(compartidos), 'es_staff', es_staff,
                            'hogares', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'nombre', h.nombre, 'borrar', h.id = any (borrar))), '[]'::jsonb)
                                          from public.households h where h.id = any (borrar || compartidos)));
end $$;

-- Retención: el detalle de correos y el registro técnico se borran a los 90 días (lo llama el cron diario).
create function public.purgar_retencion() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  c int;
  r int;
begin
  delete from public.correos_enviados where creado < now() - interval '90 days';
  get diagnostics c = row_count;
  delete from public.registro_tecnico where created_at < now() - interval '90 days';
  get diagnostics r = row_count;
  return jsonb_build_object('correos', c, 'registro_tecnico', r);
end $$;
revoke execute on function public.purgar_retencion() from public, anon, authenticated;
grant execute on function public.purgar_retencion() to service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'crear_ticket(uuid, text, text, text)', 'responder_ticket(uuid, text, boolean)', 'registrar_error(uuid, text, text, jsonb)',
    'consola_tickets(text, text)', 'consola_ticket(uuid)', 'consola_responder_ticket(uuid, text, boolean, text)',
    'consola_actualizar_ticket(uuid, text, uuid, boolean, text)', 'consola_guardar_respuesta(uuid, text, text, boolean)',
    'consola_pedir_acceso(uuid, text, int)', 'responder_acceso_soporte(uuid, text)', 'consola_accesos(uuid)', 'consola_ver_finanzas(uuid)',
    'solicitar_privacidad(text, text)', 'consola_solicitudes_privacidad()', 'consola_registrar_solicitud(text, text, text, text, date)',
    'consola_responder_solicitud(uuid, text, text)', 'consola_exportar_titular(uuid)', 'consola_supresion(uuid, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.pascua(int), private.festivos_co(int), private.sumar_habiles(date, int), private.plazo_1581(text, date),
  private.sla_de(text), private.acceso_vigente(uuid, uuid) from public, anon, authenticated;

-- Revisión de seguridad: funciones solo del servidor y tablas sensibles nuevas.
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
                       'correos_de_usuarios', 'revision_seguridad', 'custom_access_token_hook', 'campana_hogares',
                       'campana_reclamar', 'campana_avance', 'purgar_retencion')
  union all
  select 'tabla_sensible_accesible', t || ' (' || r || ')'
    from unnest(array['auditoria', 'integraciones', 'staff_invitaciones', 'eventos_pasarela', 'cupones', 'cupones_usos',
                      'hogar_notas', 'avisos_enviados', 'eventos', 'correos_enviados', 'campanas', 'hogar_activo',
                      'registro_tecnico', 'respuestas_guardadas', 'categorias_base']) t
   cross join unnest(array['anon', 'authenticated']) r
   where has_table_privilege(r, 'public.' || t, 'select') or has_table_privilege(r, 'public.' || t, 'insert')
      or has_table_privilege(r, 'public.' || t, 'update') or has_table_privilege(r, 'public.' || t, 'delete')
  union all
  select 'bucket_publico', b.id from storage.buckets b where b.public
$$;
revoke execute on function public.revision_seguridad() from public, anon, authenticated;
grant execute on function public.revision_seguridad() to service_role;
