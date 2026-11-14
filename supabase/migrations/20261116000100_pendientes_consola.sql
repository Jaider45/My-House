-- Pendientes de la consola (2026-11-16): roles propios del equipo, políticas de sesión, celular y WhatsApp
-- (avisos al equipo, recuperación de cobros y campañas), textos editables de los correos automáticos y métricas
-- del panel por periodo con historia del MRR.

-- ───────────────────────────── 1. Roles propios del equipo («Nuevo rol») ─────────────────────────────

create table public.roles_staff (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique check (length(btrim(nombre)) between 2 and 40),
  descripcion text not null default '' check (char_length(descripcion) <= 200),
  permisos    public.permiso_staff[] not null default '{}',
  creado_por  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.roles_staff is
  'Roles del equipo creados en Equipo y permisos («Nuevo rol»). Se escriben solo con consola_guardar_rol.';
alter table public.roles_staff enable row level security;
revoke all on public.roles_staff from anon, authenticated;

-- Quien tiene un rol propio guarda `rol = soporte` (nunca superadmin) y sus permisos salen de roles_staff.
alter table public.platform_staff add column rol_personal uuid references public.roles_staff (id) on delete restrict;
alter table public.staff_invitaciones add column rol_personal uuid references public.roles_staff (id) on delete cascade;

create function private.permisos_staff(s public.platform_staff) returns public.permiso_staff[]
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.permisos from public.roles_staff r where r.id = s.rol_personal), private.permisos_de_rol(s.rol))
$$;

create or replace function private.exigir_staff(p public.permiso_staff default null) returns public.platform_staff
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.platform_staff;
begin
  select * into s from public.platform_staff where user_id = (select auth.uid()) and activo;
  if s.user_id is null then
    raise exception 'No tienes acceso a la consola.';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then
    raise exception 'Verifica tu identidad con el código de dos pasos.';
  end if;
  if p is not null and not (p = any (private.permisos_staff(s))) then
    raise exception 'Tu rol no tiene permiso para esto.';
  end if;
  return s;
end $$;

-- Los permisos propios (obtenerStaff los lee en cada request para mostrar u ocultar opciones; decide la base).
create function public.mis_permisos_staff() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('permisos', to_jsonb(private.permisos_staff(s)), 'rol_nombre', r.nombre)
    from public.platform_staff s left join public.roles_staff r on r.id = s.rol_personal
   where s.user_id = (select auth.uid()) and s.activo
$$;

create function public.consola_roles() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff();
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', r.id, 'nombre', r.nombre, 'descripcion', r.descripcion, 'permisos', to_jsonb(r.permisos),
            'personas', (select count(*) from public.platform_staff p where p.rol_personal = r.id and p.activo)) order by r.nombre), '[]'::jsonb)
            from public.roles_staff r);
end $$;

-- p: {id?, nombre, descripcion, permisos[], borrar?}
create function public.consola_guardar_rol(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_nombre text := btrim(coalesce(p ->> 'nombre', ''));
  v_permisos public.permiso_staff[];
  antes public.roles_staff;
begin
  if v_id is not null then
    select * into antes from public.roles_staff where id = v_id for update;
    if antes.id is null then
      raise exception 'Ese rol no existe.';
    end if;
  end if;
  if coalesce((p ->> 'borrar')::boolean, false) then
    if exists (select 1 from public.platform_staff where rol_personal = v_id) then
      raise exception 'Hay personas con este rol. Cámbiales el rol antes de borrarlo.';
    end if;
    delete from public.roles_staff where id = v_id;
    perform private.auditar(s.user_id, s.nombre, 'borro_rol', 'rol', v_id::text, antes.nombre);
    return v_id;
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 40 then
    raise exception 'El nombre del rol va de 2 a 40 caracteres.';
  end if;
  if lower(v_nombre) in ('superadmin', 'soporte', 'finanzas', 'contenido') then
    raise exception 'Ese nombre ya lo usa un rol fijo.';
  end if;
  begin
    select coalesce(array_agg(distinct x::public.permiso_staff), '{}') into v_permisos
      from jsonb_array_elements_text(coalesce(p -> 'permisos', '[]'::jsonb)) x;
  exception when invalid_text_representation then
    raise exception 'Permiso desconocido.';
  end;
  if cardinality(v_permisos) = 0 then
    raise exception 'Elige al menos un permiso.';
  end if;
  if v_id is null then
    insert into public.roles_staff (nombre, descripcion, permisos, creado_por)
    values (v_nombre, left(coalesce(p ->> 'descripcion', ''), 200), v_permisos, s.user_id) returning id into v_id;
  else
    update public.roles_staff set nombre = v_nombre, descripcion = left(coalesce(p ->> 'descripcion', ''), 200),
           permisos = v_permisos, updated_at = now() where id = v_id;
  end if;
  perform private.auditar(s.user_id, s.nombre, case when antes.id is null then 'creo_rol' else 'edito_rol' end, 'rol', v_id::text, v_nombre,
                          jsonb_build_object('antes', to_jsonb(antes.permisos), 'despues', to_jsonb(v_permisos)));
  return v_id;
exception when unique_violation then
  raise exception 'Ya hay un rol con ese nombre.';
end $$;

drop function public.consola_equipo();
create function public.consola_equipo()
returns table (user_id uuid, nombre text, email text, rol public.rol_staff, rol_personal uuid, rol_nombre text, activo boolean,
               dos_pasos text, ultimo_ingreso timestamptz, created_at timestamptz, telefono text)
language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (private.exigir_staff()).user_id;
begin
  return query
    select p.user_id, p.nombre,
           case when p.user_id = yo then u.email::text else private.enmascarar_correo(u.email::text) end,
           p.rol, p.rol_personal, r.nombre, p.activo,
           (select string_agg(distinct f.factor_type::text, ',') from auth.mfa_factors f
             where f.user_id = p.user_id and f.status = 'verified'),
           u.last_sign_in_at, p.created_at,
           case when p.user_id = yo then c.telefono else null end
      from public.platform_staff p
      join auth.users u on u.id = p.user_id
      left join public.roles_staff r on r.id = p.rol_personal
      left join public.contactos c on c.user_id = p.user_id
     order by p.activo desc, p.created_at;
end $$;

drop function public.consola_invitaciones();
create function public.consola_invitaciones()
returns table (id uuid, email text, nombre text, rol public.rol_staff, rol_personal uuid, rol_nombre text, vence timestamptz, creada_por text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('equipo');
  return query
    select i.id, i.email, i.nombre, i.rol, i.rol_personal, r.nombre, i.vence, c.nombre, i.created_at
      from public.staff_invitaciones i
      left join public.platform_staff c on c.user_id = i.creada_por
      left join public.roles_staff r on r.id = i.rol_personal
     where i.aceptada is null
     order by i.created_at desc;
end $$;

drop function public.consola_invitar(text, text, public.rol_staff);
create function public.consola_invitar(p_email text, p_nombre text, p_rol public.rol_staff, p_rol_personal uuid default null) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  correo text := lower(btrim(p_email));
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  inv uuid;
  v_rol public.rol_staff := case when p_rol_personal is null then p_rol else 'soporte' end;
begin
  if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Escribe un correo válido.';
  end if;
  if p_rol_personal is not null and not exists (select 1 from public.roles_staff where id = p_rol_personal) then
    raise exception 'Ese rol no existe.';
  end if;
  if exists (select 1 from public.platform_staff p join auth.users u on u.id = p.user_id
              where lower(u.email) = correo and p.activo) then
    raise exception 'Esa persona ya está en el equipo.';
  end if;

  delete from public.staff_invitaciones where email = correo and aceptada is null;
  insert into public.staff_invitaciones (email, nombre, rol, rol_personal, token_hash, creada_por)
  values (correo, btrim(p_nombre), v_rol, p_rol_personal, private.huella_token(token), s.user_id)
  returning id into inv;

  perform private.auditar(s.user_id, s.nombre, 'invito_persona', 'invitacion', inv::text, btrim(p_nombre),
                          jsonb_build_object('rol', v_rol, 'rol_personal', p_rol_personal, 'correo', private.enmascarar_correo(correo)));
  return token;
end $$;

create or replace function public.consola_aceptar_invitacion(p_token text) returns public.rol_staff
language plpgsql volatile security definer set search_path = '' as $$
declare
  i public.staff_invitaciones;
  yo uuid := (select auth.uid());
  correo text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if yo is null then
    raise exception 'Ingresa para aceptar la invitación.';
  end if;
  select * into i from public.staff_invitaciones
   where token_hash = private.huella_token(p_token) and aceptada is null
   for update;
  if i.id is null then
    raise exception 'La invitación no existe o ya fue usada.';
  end if;
  if i.vence < now() then
    raise exception 'La invitación venció. Pide una nueva.';
  end if;
  if i.email <> correo then
    raise exception 'Esta invitación es para %. Ingresa con ese correo.', private.enmascarar_correo(i.email);
  end if;

  insert into public.platform_staff (user_id, nombre, rol, rol_personal, invitado_por)
  values (yo, i.nombre, i.rol, i.rol_personal, i.creada_por)
  on conflict (user_id) do update set rol = excluded.rol, rol_personal = excluded.rol_personal, activo = true,
                                      invitado_por = excluded.invitado_por, updated_at = now();
  update public.staff_invitaciones set aceptada = now() where id = i.id;

  perform private.auditar(yo, i.nombre, 'acepto_invitacion', 'persona', yo::text, i.nombre,
                          jsonb_build_object('rol', i.rol, 'rol_personal', i.rol_personal));
  return i.rol;
end $$;

drop function public.consola_cambiar_rol(uuid, public.rol_staff);
create function public.consola_cambiar_rol(p_user uuid, p_rol public.rol_staff, p_rol_personal uuid default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  antes public.platform_staff;
  v_rol public.rol_staff := case when p_rol_personal is null then p_rol else 'soporte' end;
begin
  if p_user = s.user_id then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;
  if p_rol_personal is not null and not exists (select 1 from public.roles_staff where id = p_rol_personal) then
    raise exception 'Ese rol no existe.';
  end if;
  select * into antes from public.platform_staff where user_id = p_user for update;
  if antes.user_id is null then
    raise exception 'Esa persona no está en el equipo.';
  end if;
  if antes.rol = v_rol and antes.rol_personal is not distinct from p_rol_personal then
    return;
  end if;
  update public.platform_staff set rol = v_rol, rol_personal = p_rol_personal, updated_at = now() where user_id = p_user;
  perform private.auditar(s.user_id, s.nombre, 'cambio_rol', 'persona', p_user::text, antes.nombre,
                          jsonb_build_object('antes', antes.rol, 'antes_personal', antes.rol_personal, 'despues', v_rol, 'despues_personal', p_rol_personal));
end $$;

-- Avisos al equipo: los roles de un aviso pueden ser fijos o el id de un rol propio.
create or replace function public.correos_del_equipo(p_roles text[]) returns table (nombre text, email text)
language sql stable security definer set search_path = '' as $$
  select s.nombre, u.email::text
    from public.platform_staff s join auth.users u on u.id = s.user_id
   where s.activo and ((s.rol_personal is null and (s.rol::text = any (p_roles) or s.rol = 'superadmin'))
                       or s.rol_personal::text = any (p_roles))
$$;

-- ───────────────────────────── 2. Celular y WhatsApp ─────────────────────────────

-- Un celular por persona (no por hogar: la misma persona puede estar en varios). `whatsapp` = autorizó avisos por
-- WhatsApp (Meta exige el consentimiento). Responder «BAJA» al número de My House lo apaga (webhook).
create table public.contactos (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  telefono       text check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp       boolean not null default false,
  whatsapp_desde timestamptz,
  updated_at     timestamptz not null default now(),
  check (not whatsapp or telefono is not null)
);
alter table public.contactos enable row level security;
create policy "contactos: la propia" on public.contactos for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.contactos from anon, authenticated;
revoke all on public.contactos from anon;

create function public.guardar_contacto(p_telefono text, p_whatsapp boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g'), '');
begin
  if yo is null then
    raise exception 'Ingresa de nuevo.';
  end if;
  if tel is not null and tel !~ '^\+' then
    tel := case when length(tel) = 10 and tel ~ '^3' then '+57' || tel else '+' || tel end;
  end if;
  if tel is not null and tel !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Escribe el celular con indicativo, por ejemplo +57 300 123 4567.';
  end if;
  if p_whatsapp and tel is null then
    raise exception 'Para recibir avisos por WhatsApp escribe tu celular.';
  end if;
  insert into public.contactos (user_id, telefono, whatsapp, whatsapp_desde, updated_at)
  values (yo, tel, coalesce(p_whatsapp, false), case when p_whatsapp then now() end, now())
  on conflict (user_id) do update
     set telefono = excluded.telefono, whatsapp = excluded.whatsapp, updated_at = now(),
         whatsapp_desde = case when excluded.whatsapp and not public.contactos.whatsapp then now()
                               when excluded.whatsapp then public.contactos.whatsapp_desde end;
end $$;

-- Servidor: celulares con WhatsApp autorizado de unas personas (campañas y cobros) o del equipo (avisos).
create function public.telefonos_whatsapp(p_ids uuid[]) returns table (user_id uuid, telefono text)
language sql stable security definer set search_path = '' as $$
  select c.user_id, c.telefono from public.contactos c where c.user_id = any (p_ids) and c.whatsapp and c.telefono is not null
$$;

create function public.telefonos_del_equipo(p_roles text[]) returns table (nombre text, telefono text)
language sql stable security definer set search_path = '' as $$
  select s.nombre, c.telefono
    from public.platform_staff s join public.contactos c on c.user_id = s.user_id
   where s.activo and c.whatsapp and c.telefono is not null
     and ((s.rol_personal is null and (s.rol::text = any (p_roles) or s.rol = 'superadmin')) or s.rol_personal::text = any (p_roles))
$$;

-- Registro de los mensajes de WhatsApp (destinatario enmascarado). El webhook de Meta sube el estado.
create table public.mensajes_whatsapp (
  id          bigint generated always as identity primary key,
  creado      timestamptz not null default now(),
  wamid       text unique,
  tipo        text not null check (tipo in ('aviso_equipo', 'campana', 'cobro', 'prueba', 'otro')),
  referencia  text,
  plantilla   text not null,
  para        text not null,
  estado      text not null default 'enviado' check (estado in ('enviado', 'entregado', 'leido', 'fallido')),
  error       text,
  actualizado timestamptz not null default now()
);
create index mensajes_whatsapp_creado on public.mensajes_whatsapp (creado desc);
alter table public.mensajes_whatsapp enable row level security;
revoke all on public.mensajes_whatsapp from anon, authenticated;

-- El estado solo avanza (enviado → entregado → leído); «fallido» siempre se registra.
create function public.mensaje_whatsapp_estado(p_wamid text, p_estado text, p_error text default null) returns void
language sql volatile security definer set search_path = '' as $$
  update public.mensajes_whatsapp m
     set estado = p_estado, error = coalesce(left(p_error, 300), m.error), actualizado = now()
   where m.wamid = p_wamid
     and (p_estado = 'fallido'
          or array_position(array['enviado', 'entregado', 'leido'], p_estado) > coalesce(array_position(array['enviado', 'entregado', 'leido'], m.estado), 0))
$$;

create function public.consola_mensajes_whatsapp() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'conteos', (select jsonb_build_object(
                  'total', count(*), 'entregados', count(*) filter (where estado in ('entregado', 'leido')),
                  'leidos', count(*) filter (where estado = 'leido'), 'fallidos', count(*) filter (where estado = 'fallido'))
                  from public.mensajes_whatsapp where creado > now() - interval '30 days'),
    'autorizados', (select count(*) from public.contactos where whatsapp),
    'ultimos', (select coalesce(jsonb_agg(to_jsonb(x) order by x.creado desc), '[]'::jsonb) from (
                  select creado, tipo, plantilla, para, estado, error from public.mensajes_whatsapp order by creado desc limit 20) x));
end $$;

-- Campañas por WhatsApp: el canal, la plantilla aprobada y qué variable va en cada {{n}}.
alter table public.campanas
  add column canal text not null default 'correo' check (canal in ('correo', 'whatsapp')),
  add column plantilla_whatsapp uuid references public.plantillas_whatsapp (id) on delete set null,
  add column whatsapp_vars text[] not null default '{}';

create function public.consola_campana_canal(p_id uuid, p_canal text, p_plantilla uuid, p_vars text[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('campanas');
  c public.campanas;
  pl public.plantillas_whatsapp;
begin
  select * into c from public.campanas where id = p_id for update;
  if c.id is null then
    raise exception 'No encontramos esa campaña.';
  end if;
  if c.estado not in ('borrador', 'programada') then
    raise exception 'Esta campaña ya salió.';
  end if;
  if p_canal not in ('correo', 'whatsapp') then
    raise exception 'Canal desconocido.';
  end if;
  if p_canal = 'whatsapp' then
    select * into pl from public.plantillas_whatsapp where id = p_plantilla;
    if pl.id is null or pl.estado <> 'aprobada' then
      raise exception 'Elige una plantilla de WhatsApp aprobada por Meta.';
    end if;
    if cardinality(coalesce(p_vars, '{}')) <> (select count(distinct m[1]) from regexp_matches(pl.cuerpo, '\{\{(\d+)\}\}', 'g') m) then
      raise exception 'Elige qué va en cada variable de la plantilla.';
    end if;
    if exists (select 1 from unnest(p_vars) v where v not in ('nombre', 'hogar', 'plan', 'minimo', 'fecha_pago')) then
      raise exception 'Variable desconocida.';
    end if;
  end if;
  update public.campanas set canal = p_canal, plantilla_whatsapp = case when p_canal = 'whatsapp' then p_plantilla end,
         whatsapp_vars = case when p_canal = 'whatsapp' then coalesce(p_vars, '{}') else '{}' end
   where id = p_id;
  perform private.auditar(s.user_id, s.nombre, 'campana_canal', 'campana', p_id::text, c.nombre,
                          jsonb_build_object('canal', p_canal, 'plantilla', pl.nombre));
end $$;

create or replace function public.purgar_retencion() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  c int;
  r int;
  w int;
begin
  delete from public.correos_enviados where creado < now() - interval '90 days';
  get diagnostics c = row_count;
  delete from public.registro_tecnico where created_at < now() - interval '90 days';
  get diagnostics r = row_count;
  delete from public.mensajes_whatsapp where creado < now() - interval '90 days';
  get diagnostics w = row_count;
  return jsonb_build_object('correos', c, 'registro_tecnico', r, 'whatsapp', w);
end $$;

-- ───────────────────────────── 3. Ajustes nuevos ─────────────────────────────

insert into public.plataforma_config (clave, valor) values
  ('consola_sesion', '{"minutos": 30}'),
  ('correos_textos', '{}'),
  ('whatsapp_usos', '{
     "aviso_equipo":     {"plantilla": "", "variables": ["titulo", "texto"]},
     "cobro_mora":       {"plantilla": "", "variables": ["nombre", "plan", "monto", "baja"]},
     "cobro_renovacion": {"plantilla": "", "variables": ["nombre", "plan", "monto", "vence"]},
     "cobro_gratis":     {"plantilla": "", "variables": ["nombre", "plan"]}
   }')
on conflict (clave) do nothing;
update public.plataforma_config set valor = valor || '{"sesion_dias": 0}' where clave = 'limites_app' and not valor ? 'sesion_dias';
update public.plataforma_config c
   set valor = (select jsonb_object_agg(k, v || '{"whatsapp": false}') from jsonb_each(c.valor) e(k, v))
 where clave = 'avisos_equipo' and valor <> '{}'::jsonb;

-- ───────────────────────────── 4. Panel por periodo e historia del MRR ─────────────────────────────

-- MRR de cada cierre de mes (últimos 12), estimado con los cobros pagados: un cobro cubre 1 o 12 meses desde que se
-- pagó (más 3 días de gracia); el anual cuenta su doceava parte. Se toma el último cobro de cada hogar que cubra la fecha.
create function public.consola_metricas_periodo(p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d int := case when p_dias in (7, 30, 365) then p_dias else 30 end;
  desde timestamptz := now() - make_interval(days => d);
  pagando int;
  cancel int;
begin
  perform private.exigir_staff('ver_hogares');
  select count(*) into pagando from public.suscripciones s where s.estado in ('activa', 'vencida');
  select count(*) into cancel from public.eventos where tipo = 'cancelacion' and creado > desde;
  return jsonb_build_object(
    'dias', d,
    'activos', (select count(distinct t.household_id) from public.transactions t where t.created_at > desde and private.mov_activo(t.origen)),
    'nuevos', (select count(*) from public.households where created_at > desde),
    'cancelaciones', cancel,
    'churn_pct', case when pagando + cancel = 0 then null else round(100.0 * cancel / (pagando + cancel), 1) end,
    'cobrado', (select coalesce(sum(monto), 0) from public.cobros where pagado_en > desde and estado = 'pagado'),
    'serie', case when d = 365 then
               (select coalesce(jsonb_agg(jsonb_build_object('etiqueta', to_char(m.x, 'YYYY-MM'), 'nuevos',
                  (select count(*) from public.households h where date_trunc('month', h.created_at at time zone 'America/Bogota') = m.x)) order by m.x), '[]'::jsonb)
                  from (select date_trunc('month', now() at time zone 'America/Bogota') - make_interval(months => n) as x from generate_series(11, 0, -1) n) m)
             else
               (select coalesce(jsonb_agg(jsonb_build_object('etiqueta', to_char(g.x, 'YYYY-MM-DD'), 'nuevos',
                  (select count(*) from public.households h where (h.created_at at time zone 'America/Bogota')::date = g.x)) order by g.x), '[]'::jsonb)
                  from (select (now() at time zone 'America/Bogota')::date - n as x from generate_series(d - 1, 0, -1) n) g)
             end,
    'mrr_historia', (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m.x, 'YYYY-MM'), 'mrr', coalesce(m.mrr, 0)) order by m.x), '[]'::jsonb)
                       from (select f.x, (select sum(case u.periodo when 'anual' then round(u.monto / 12.0) else u.monto end)
                                            from (select distinct on (c.household_id) c.periodo, c.monto
                                                    from public.cobros c
                                                   where c.estado = 'pagado' and c.pagado_en is not null
                                                     and c.pagado_en <= f.corte
                                                     and c.pagado_en + case c.periodo when 'anual' then interval '12 months' else interval '1 month' end + interval '3 days' > f.corte
                                                   order by c.household_id, c.pagado_en desc) u)::bigint as mrr
                               from (select date_trunc('month', now()) - make_interval(months => n) as x,
                                            least(now(), date_trunc('month', now()) - make_interval(months => n - 1)) as corte
                                       from generate_series(11, 0, -1) n) f) m));
end $$;

create or replace function public.consola_guardar_ajuste(p_clave text, p_valor jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff;
  antes jsonb;
  k text;
  v jsonb;
begin
  s := private.exigir_staff(case when p_clave in ('correos_apagados', 'correos_textos') then 'campanas'
                               when p_clave = 'consola_sesion' then 'equipo' else 'sistema' end::public.permiso_staff);
  select valor into antes from public.plataforma_config where clave = p_clave for update;
  if antes is null or p_clave not in ('empresa', 'envios', 'cobro_reintentos', 'cobro_dia_gratis', 'factura', 'avisos_equipo', 'limites_app', 'correos_apagados',
                                     'correos_textos', 'whatsapp_usos', 'consola_sesion') then
    raise exception 'Ese ajuste no existe.';
  end if;
  if jsonb_typeof(p_valor) = 'object' and p_clave <> 'correos_textos' then
    for k, v in select * from jsonb_each(p_valor) loop
      if not antes ? k then
        raise exception 'Campo desconocido: %', k;
      end if;
      if jsonb_typeof(v) = 'string' and char_length(v #>> '{}') > 200 then
        raise exception 'El campo % es demasiado largo.', k;
      end if;
    end loop;
    p_valor := antes || p_valor;
  end if;
  case p_clave
    when 'correos_apagados' then
      if jsonb_typeof(p_valor) <> 'array' or exists (select 1 from jsonb_array_elements_text(p_valor) e
           where e not in ('bienvenida', 'proximo', 'vencido', 'resumen', 'dian', 'plazo')) then
        raise exception 'Ese correo no se puede apagar.';
      end if;
    when 'cobro_reintentos' then
      if jsonb_typeof(p_valor) <> 'array' or jsonb_array_length(p_valor) not between 1 and 5
         or exists (select 1 from jsonb_array_elements(p_valor) d where jsonb_typeof(d) <> 'number' or (d #>> '{}')::int not between 1 and 30) then
        raise exception 'Los reintentos son de 1 a 5 días entre el 1 y el 30.';
      end if;
      select jsonb_agg(d order by (d #>> '{}')::int) into p_valor from (select distinct d from jsonb_array_elements(p_valor) d) x;
    when 'cobro_dia_gratis' then
      if jsonb_typeof(p_valor) <> 'number' or (p_valor #>> '{}')::int not between 7 and 60 then
        raise exception 'El paso a Gratis va entre el día 7 y el 60.';
      end if;
      if (p_valor #>> '{}')::int <= (select max((d #>> '{}')::int) from public.plataforma_config c, jsonb_array_elements(c.valor) d where c.clave = 'cobro_reintentos') then
        raise exception 'El paso a Gratis debe ser después del último reintento.';
      end if;
    when 'empresa' then
      if (p_valor ->> 'correo_contacto') <> '' and (p_valor ->> 'correo_contacto') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'El correo de contacto no es válido.';
      end if;
    when 'envios' then
      if (p_valor ->> 'responder_a') <> '' and (p_valor ->> 'responder_a') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'El correo de «Responder a» no es válido.';
      end if;
      if (p_valor ->> 'wa_desde') !~ '^([01]\d|2[0-3]):[0-5]\d$' or (p_valor ->> 'wa_hasta') !~ '^([01]\d|2[0-3]):[0-5]\d$'
         or (p_valor ->> 'wa_desde') >= (p_valor ->> 'wa_hasta') then
        raise exception 'El horario va de HH:MM a HH:MM y el inicio va antes del fin.';
      end if;
    when 'factura' then
      if (p_valor -> 'desde') <> 'null' and (p_valor -> 'hasta') <> 'null'
         and (p_valor ->> 'desde')::bigint > (p_valor ->> 'hasta')::bigint then
        raise exception 'El rango de facturación empieza antes de terminar.';
      end if;
    when 'limites_app' then
      if (p_valor ->> 'comprobante_mb')::int not between 1 and 25 then
        raise exception 'Un comprobante puede pesar de 1 a 25 MB.';
      end if;
      if (p_valor ->> 'intentos_bloqueo')::int not between 3 and 20 then
        raise exception 'El bloqueo va de 3 a 20 intentos.';
      end if;
      if (p_valor ->> 'sesion_dias')::int not between 0 and 90 then
        raise exception 'El cierre por inactividad va de 0 (nunca) a 90 días.';
      end if;
    when 'consola_sesion' then
      if (p_valor ->> 'minutos')::int not between 5 and 240 then
        raise exception 'La consola se cierra entre 5 y 240 minutos sin uso.';
      end if;
    when 'correos_textos' then
      if jsonb_typeof(p_valor) <> 'object' then
        raise exception 'Textos mal formados.';
      end if;
      for k, v in select * from jsonb_each(p_valor) loop
        if k !~ '^[a-z][a-z0-9-]{1,40}$' or jsonb_typeof(v) <> 'object'
           or exists (select 1 from jsonb_each(v) t where t.key not in ('asunto', 'vista_previa', 'titulo', 'intro', 'nota', 'boton')
                                                        or jsonb_typeof(t.value) <> 'string' or char_length(t.value #>> '{}') > 600) then
          raise exception 'Textos del correo % mal formados.', k;
        end if;
      end loop;
    when 'whatsapp_usos' then
      for k, v in select * from jsonb_each(p_valor) loop
        if coalesce(v ->> 'plantilla', '') !~ '^([a-z][a-z0-9_]{0,100})?$' or jsonb_typeof(v -> 'variables') <> 'array'
           or jsonb_array_length(v -> 'variables') > 10 then
          raise exception 'Uso de WhatsApp % mal formado.', k;
        end if;
      end loop;
    when 'avisos_equipo' then
      for k, v in select * from jsonb_each(p_valor) loop
        if jsonb_typeof(v -> 'activo') <> 'boolean' or jsonb_typeof(v -> 'roles') <> 'array'
           or (v ? 'whatsapp' and jsonb_typeof(v -> 'whatsapp') <> 'boolean')
           or exists (select 1 from jsonb_array_elements_text(v -> 'roles') r
                       where r not in ('superadmin', 'soporte', 'finanzas', 'contenido')
                         and not exists (select 1 from public.roles_staff x where x.id::text = r)) then
          raise exception 'Aviso % mal formado.', k;
        end if;
      end loop;
    else null;
  end case;
  update public.plataforma_config set valor = p_valor, updated_at = now() where clave = p_clave;
  perform private.auditar(s.user_id, s.nombre, 'edito_ajuste', 'ajuste', p_clave, p_clave, jsonb_build_object('antes', antes, 'despues', p_valor));
end $$;

create or replace function public.consola_tickets(p_estado text, p_asignado text) returns jsonb
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
                 from public.platform_staff p where p.activo and 'tickets' = any (private.permisos_staff(p))));
end $$;

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
     and p.proname not in ('ver_invitacion', 'consola_ver_invitacion', 'revision_legal_ver', 'revision_legal_responder')
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
                       'campana_reclamar', 'campana_avance', 'purgar_retencion', 'guardar_metodo_pago',
                       'cobro_transaccion', 'cobros_para_debitar', 'correos_del_equipo', 'tickets_sin_respuesta',
                       'ingreso_bloqueado', 'registrar_ingreso', 'legal_avisos_pendientes', 'correos_titulares',
                       'plantilla_estado_meta', 'salud_registrar',
                       'telefonos_whatsapp', 'telefonos_del_equipo', 'mensaje_whatsapp_estado')
  union all
  select 'tabla_sensible_accesible', t || ' (' || r || ')'
    from unnest(array['auditoria', 'integraciones', 'staff_invitaciones', 'eventos_pasarela', 'cupones', 'cupones_usos',
                      'hogar_notas', 'avisos_enviados', 'eventos', 'correos_enviados', 'campanas', 'hogar_activo',
                      'registro_tecnico', 'respuestas_guardadas', 'categorias_base', 'documento_revisiones',
                      'intentos_ingreso', 'avisos_equipo_enviados', 'ofertas', 'ofertas_cerradas', 'enlaces_clics', 'aliados',
                      'plantillas_whatsapp', 'academia_vistas', 'academia_calificaciones', 'academia_recomendaciones',
                      'academia_talleres', 'academia_inscripciones', 'segmentos', 'salud_registros',
                      'roles_staff', 'mensajes_whatsapp']) t
   cross join unnest(array['anon', 'authenticated']) r
   where has_table_privilege(r, 'public.' || t, 'select') or has_table_privilege(r, 'public.' || t, 'insert')
      or has_table_privilege(r, 'public.' || t, 'update') or has_table_privilege(r, 'public.' || t, 'delete')
  union all
  select 'bucket_publico', b.id from storage.buckets b where b.public
$$;

do $$
declare
  f text;
begin
  foreach f in array array['mis_permisos_staff()', 'consola_roles()', 'consola_guardar_rol(jsonb)', 'consola_equipo()', 'consola_invitaciones()',
    'consola_invitar(text, text, public.rol_staff, uuid)', 'consola_cambiar_rol(uuid, public.rol_staff, uuid)', 'guardar_contacto(text, boolean)',
    'consola_mensajes_whatsapp()', 'consola_campana_canal(uuid, text, uuid, text[])', 'consola_metricas_periodo(int)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['telefonos_whatsapp(uuid[])', 'telefonos_del_equipo(text[])', 'mensaje_whatsapp_estado(text, text, text)', 'purgar_retencion()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
