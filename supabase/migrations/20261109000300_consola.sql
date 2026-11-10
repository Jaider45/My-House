-- Consola del equipo de My House (roadmap SaaS, fase S1): personas del equipo, permisos por rol, invitaciones y
-- auditoría inmutable. El equipo NO es miembro de ningún hogar por serlo: nada de esto abre datos financieros.
--
-- Reglas:
--  * Todo pasa por funciones `consola_*` (security definer) que exigen persona activa del equipo, sesión AAL2
--    (verificación en dos pasos) y el permiso de su rol. Las tablas no tienen políticas de escritura.
--  * Las funciones devuelven datos del equipo y de la auditoría; nunca movimientos ni montos de un hogar.
--  * La auditoría no se edita ni se borra (trigger), ni siquiera con service_role.

create type public.rol_staff as enum ('superadmin', 'soporte', 'finanzas', 'contenido');

-- Una fila por casilla de la matriz «Roles y permisos» del diseño (AdminEquipo) + ver la auditoría.
create type public.permiso_staff as enum (
  'ver_hogares',  -- lista de hogares y métricas
  'ver_finanzas', -- datos financieros de un hogar, solo con permiso de su administrador (fase S7)
  'tickets',      -- responder tickets
  'cobros',       -- reembolsos y cambios de plan
  'planes',       -- planes, precios y cupones
  'parametros',   -- parámetros DIAN y catálogos
  'campanas',     -- enviar campañas
  'equipo',       -- gestionar equipo y roles
  'exportar',     -- exportar datos
  'sistema',      -- feature flags y mantenimiento
  'auditoria'     -- ver y exportar el registro de auditoría
);

-- Matriz fija (cambiarla = nueva migración). `src/lib/consola/permisos.ts` la replica para la interfaz y
-- `tests/rls/consola.test.ts` verifica que coincidan.
create function private.permisos_de_rol(r public.rol_staff) returns public.permiso_staff[]
language sql immutable set search_path = '' as $$
  select case r
    when 'superadmin' then enum_range(null::public.permiso_staff)
    when 'soporte'    then array['ver_hogares', 'ver_finanzas', 'tickets']::public.permiso_staff[]
    when 'finanzas'   then array['ver_hogares', 'cobros', 'planes', 'exportar']::public.permiso_staff[]
    when 'contenido'  then array['ver_hogares', 'tickets', 'parametros', 'campanas']::public.permiso_staff[]
  end
$$;

create table public.platform_staff (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  nombre       text not null check (length(btrim(nombre)) between 1 and 80),
  rol          public.rol_staff not null,
  activo       boolean not null default true,
  invitado_por uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.platform_staff is
  'Personas del equipo de My House con acceso a /consola. Se escribe solo con las funciones consola_*.';

alter table public.platform_staff enable row level security;
-- Cada quien ve su propia fila (la consola la lee en cada request para cortar el acceso al desactivar a alguien).
create policy "staff: su propia fila" on public.platform_staff
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.platform_staff from anon, authenticated;
revoke all on public.platform_staff from anon;

create table public.staff_invitaciones (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  nombre     text not null check (length(btrim(nombre)) between 1 and 80),
  rol        public.rol_staff not null,
  -- Se guarda la huella del token, no el token: quien lea la tabla no puede aceptar la invitación.
  token_hash text not null unique,
  creada_por uuid references auth.users (id) on delete set null,
  vence      timestamptz not null default now() + interval '7 days',
  aceptada   timestamptz,
  created_at timestamptz not null default now()
);
create unique index staff_invitaciones_pendiente on public.staff_invitaciones (email) where aceptada is null;
alter table public.staff_invitaciones enable row level security;
revoke all on public.staff_invitaciones from anon, authenticated;

create table public.auditoria (
  id            bigint generated always as identity primary key,
  creada        timestamptz not null default now(),
  quien         uuid,           -- null = el sistema o un script con service_role
  quien_nombre  text not null,
  accion        text not null,
  objeto_tipo   text,
  objeto_id     text,
  objeto_nombre text,
  detalle       jsonb not null default '{}'::jsonb,
  ip            text,
  agente        text
);
comment on table public.auditoria is
  'Todo lo que hace el equipo en la consola. Inmutable: sin políticas y con un trigger que impide editar o borrar.';
create index auditoria_creada on public.auditoria (creada desc);
alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;

create function private.auditoria_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'El registro de auditoría no se puede modificar.';
end $$;

create trigger auditoria_sin_cambios before update or delete on public.auditoria
  for each row execute function private.auditoria_inmutable();
create trigger auditoria_sin_vaciar before truncate on public.auditoria
  for each statement execute function private.auditoria_inmutable();

-- ───────────────────────────── utilidades ─────────────────────────────

-- Cabeceras de la petición a PostgREST. La app manda la IP y el navegador de quien usa la consola en
-- `x-mh-ip` / `x-mh-agente` (src/lib/consola/cliente.ts); si no vienen, se usa lo que llegue.
create function private.cabecera(nombre text) returns text
language sql stable set search_path = '' as $$
  select nullif(current_setting('request.headers', true), '')::json ->> nombre
$$;

create function private.enmascarar_correo(correo text) returns text
language sql immutable set search_path = '' as $$
  select case when correo is null or position('@' in correo) < 2 then correo
              else left(correo, 1) || '•••••' || substr(correo, position('@' in correo)) end
$$;

-- IPv4: 181.52.•.•  ·  IPv6: primeros dos bloques.
create function private.enmascarar_ip(ip text) returns text
language sql immutable set search_path = '' as $$
  select case when ip is null then null
              when ip ~ '^\d+\.\d+\.\d+\.\d+$' then split_part(ip, '.', 1) || '.' || split_part(ip, '.', 2) || '.•.•'
              else split_part(ip, ':', 1) || ':' || split_part(ip, ':', 2) || ':•' end
$$;

-- Persona del equipo que llama, o excepción. Exige AAL2 en la base (no solo en el proxy): un token robado sin el
-- segundo factor no sirve para la consola.
create function private.exigir_staff(p public.permiso_staff default null) returns public.platform_staff
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
  if p is not null and not (p = any (private.permisos_de_rol(s.rol))) then
    raise exception 'Tu rol no tiene permiso para esto.';
  end if;
  return s;
end $$;

create function private.auditar(
  quien uuid, quien_nombre text, accion text,
  objeto_tipo text default null, objeto_id text default null, objeto_nombre text default null,
  detalle jsonb default '{}'::jsonb
) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.auditoria (quien, quien_nombre, accion, objeto_tipo, objeto_id, objeto_nombre, detalle, ip, agente)
  values (quien, quien_nombre, accion, objeto_tipo, objeto_id, objeto_nombre, coalesce(detalle, '{}'::jsonb),
          left(coalesce(private.cabecera('x-mh-ip'), btrim(split_part(private.cabecera('x-forwarded-for'), ',', 1))), 64),
          left(coalesce(private.cabecera('x-mh-agente'), private.cabecera('user-agent')), 300))
$$;

create function private.huella_token(token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

-- ───────────────────────────── funciones de la consola ─────────────────────────────

-- Matriz de permisos (pantalla Equipo y permisos).
create function public.consola_matriz_permisos() returns table (rol public.rol_staff, permisos public.permiso_staff[])
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff();
  return query select r, private.permisos_de_rol(r) from unnest(enum_range(null::public.rol_staff)) r;
end $$;

-- Se llama al terminar el ingreso con el segundo factor.
create function public.consola_registrar_ingreso() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff();
begin
  perform private.auditar(s.user_id, s.nombre, 'ingreso_consola');
end $$;

create function public.consola_equipo()
returns table (user_id uuid, nombre text, email text, rol public.rol_staff, activo boolean, dos_pasos text,
               ultimo_ingreso timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (private.exigir_staff()).user_id;
begin
  return query
    select p.user_id, p.nombre,
           case when p.user_id = yo then u.email::text else private.enmascarar_correo(u.email::text) end,
           p.rol, p.activo,
           (select string_agg(distinct f.factor_type::text, ',') from auth.mfa_factors f
             where f.user_id = p.user_id and f.status = 'verified'),
           u.last_sign_in_at, p.created_at
      from public.platform_staff p
      join auth.users u on u.id = p.user_id
     order by p.activo desc, p.created_at;
end $$;

create function public.consola_invitaciones()
returns table (id uuid, email text, nombre text, rol public.rol_staff, vence timestamptz, creada_por text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('equipo');
  return query
    select i.id, i.email, i.nombre, i.rol, i.vence, c.nombre, i.created_at
      from public.staff_invitaciones i
      left join public.platform_staff c on c.user_id = i.creada_por
     where i.aceptada is null
     order by i.created_at desc;
end $$;

-- Crea (o reemplaza) la invitación pendiente de ese correo y devuelve el token, que solo viaja en el enlace.
create function public.consola_invitar(p_email text, p_nombre text, p_rol public.rol_staff) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  correo text := lower(btrim(p_email));
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  inv uuid;
begin
  if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Escribe un correo válido.';
  end if;
  if exists (select 1 from public.platform_staff p join auth.users u on u.id = p.user_id
              where lower(u.email) = correo and p.activo) then
    raise exception 'Esa persona ya está en el equipo.';
  end if;

  delete from public.staff_invitaciones where email = correo and aceptada is null;
  insert into public.staff_invitaciones (email, nombre, rol, token_hash, creada_por)
  values (correo, btrim(p_nombre), p_rol, private.huella_token(token), s.user_id)
  returning id into inv;

  perform private.auditar(s.user_id, s.nombre, 'invito_persona', 'invitacion', inv::text, btrim(p_nombre),
                          jsonb_build_object('rol', p_rol, 'correo', private.enmascarar_correo(correo)));
  return token;
end $$;

create function public.consola_cancelar_invitacion(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  i public.staff_invitaciones;
begin
  delete from public.staff_invitaciones where id = p_id and aceptada is null returning * into i;
  if i.id is null then
    raise exception 'No encontramos esa invitación o ya fue aceptada.';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'cancelo_invitacion', 'invitacion', i.id::text, i.nombre,
                          jsonb_build_object('rol', i.rol, 'correo', private.enmascarar_correo(i.email)));
end $$;

-- Datos para la pantalla de la invitación (sin sesión). No revela el correo completo.
create function public.consola_ver_invitacion(p_token text)
returns table (nombre text, rol public.rol_staff, email text, vencida boolean)
language sql stable security definer set search_path = '' as $$
  select i.nombre, i.rol, private.enmascarar_correo(i.email), i.vence < now()
    from public.staff_invitaciones i
   where i.token_hash = private.huella_token(p_token) and i.aceptada is null
$$;

-- La acepta la persona con sesión iniciada y el mismo correo de la invitación. No exige AAL2: después de aceptar,
-- el proxy la lleva a activar o usar la verificación en dos pasos antes de entrar.
create function public.consola_aceptar_invitacion(p_token text) returns public.rol_staff
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

  insert into public.platform_staff (user_id, nombre, rol, invitado_por)
  values (yo, i.nombre, i.rol, i.creada_por)
  on conflict (user_id) do update set rol = excluded.rol, activo = true, invitado_por = excluded.invitado_por, updated_at = now();
  update public.staff_invitaciones set aceptada = now() where id = i.id;

  perform private.auditar(yo, i.nombre, 'acepto_invitacion', 'persona', yo::text, i.nombre, jsonb_build_object('rol', i.rol));
  return i.rol;
end $$;

create function public.consola_cambiar_rol(p_user uuid, p_rol public.rol_staff) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  antes public.platform_staff;
begin
  if p_user = s.user_id then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;
  select * into antes from public.platform_staff where user_id = p_user for update;
  if antes.user_id is null then
    raise exception 'Esa persona no está en el equipo.';
  end if;
  if antes.rol = p_rol then
    return;
  end if;
  update public.platform_staff set rol = p_rol, updated_at = now() where user_id = p_user;
  perform private.auditar(s.user_id, s.nombre, 'cambio_rol', 'persona', p_user::text, antes.nombre,
                          jsonb_build_object('antes', antes.rol, 'despues', p_rol));
end $$;

-- Desactivar corta el acceso de inmediato: toda función exige `activo` y la consola lee la fila en cada request.
create function public.consola_activar(p_user uuid, p_activo boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  antes public.platform_staff;
begin
  if p_user = s.user_id then
    raise exception 'No puedes desactivarte a ti mismo.';
  end if;
  select * into antes from public.platform_staff where user_id = p_user for update;
  if antes.user_id is null then
    raise exception 'Esa persona no está en el equipo.';
  end if;
  if antes.activo = p_activo then
    return;
  end if;
  update public.platform_staff set activo = p_activo, updated_at = now() where user_id = p_user;
  perform private.auditar(s.user_id, s.nombre, case when p_activo then 'reactivo_persona' else 'desactivo_persona' end,
                          'persona', p_user::text, antes.nombre);
end $$;

-- Registro de auditoría, del más reciente al más antiguo, por páginas (cursor = id). IP enmascarada.
create function public.consola_auditoria(p_antes bigint default null, p_limite int default 50)
returns table (id bigint, creada timestamptz, quien_nombre text, accion text, objeto_tipo text, objeto_nombre text,
               detalle jsonb, ip text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('auditoria');
  return query
    select a.id, a.creada, a.quien_nombre, a.accion, a.objeto_tipo, a.objeto_nombre, a.detalle, private.enmascarar_ip(a.ip)
      from public.auditoria a
     where p_antes is null or a.id < p_antes
     order by a.id desc
     limit least(greatest(coalesce(p_limite, 50), 1), 200);
end $$;

-- Exportación completa (con IP y navegador) de un rango de fechas. La exportación misma queda auditada.
create function public.consola_exportar_auditoria(p_desde timestamptz, p_hasta timestamptz)
returns setof public.auditoria
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('auditoria');
begin
  if p_hasta < p_desde or p_hasta - p_desde > interval '366 days' then
    raise exception 'Elige un rango de hasta un año.';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'exporto_auditoria', null, null, null,
                          jsonb_build_object('desde', p_desde, 'hasta', p_hasta));
  return query select * from public.auditoria a where a.creada >= p_desde and a.creada < p_hasta order by a.id;
end $$;

-- Las funciones de la consola solo las llaman personas con sesión; la de ver invitación, también sin sesión.
do $$
declare
  f text;
begin
  foreach f in array array[
    'consola_matriz_permisos()', 'consola_registrar_ingreso()', 'consola_equipo()', 'consola_invitaciones()',
    'consola_invitar(text, text, public.rol_staff)', 'consola_cancelar_invitacion(uuid)',
    'consola_aceptar_invitacion(text)', 'consola_cambiar_rol(uuid, public.rol_staff)',
    'consola_activar(uuid, boolean)', 'consola_auditoria(bigint, int)',
    'consola_exportar_auditoria(timestamptz, timestamptz)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant execute on function public.consola_ver_invitacion(text) to anon, authenticated;

-- ───────────────────────────── claim del JWT ─────────────────────────────

-- Igual que la versión anterior + `staff: {rol, nombre}` para quien está activo en el equipo. El proxy lo usa
-- para el chequeo optimista de /consola; la autorización real sigue en exigir_staff().
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
           'cuota_imprevistos_pct', coalesce((h.config ->> 'cuota_imprevistos_pct')::int, 10))
    into ctx
    from public.members m
    join public.households h on h.id = m.household_id
   where m.user_id = uid
   order by m.created_at
   limit 1;
  claims := case when ctx is null then claims - 'hogar' else jsonb_set(claims, '{hogar}', ctx) end;

  select jsonb_build_object('rol', p.rol, 'nombre', p.nombre) into staff
    from public.platform_staff p where p.user_id = uid and p.activo;
  claims := case when staff is null then claims - 'staff' else jsonb_set(claims, '{staff}', staff) end;

  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
