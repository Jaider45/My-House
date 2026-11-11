-- SaaS S8: feature flags (por plan, porcentaje estable de hogares o solo el equipo) y estado del sistema.
-- El modo mantenimiento NO va aquí: lo lee el proxy de una variable de entorno en cada request (roadmap 4.11).

create table public.funciones (
  clave       text primary key check (clave ~ '^[a-z][a-z0-9_]{1,40}$'),
  descripcion text check (char_length(descripcion) <= 200),
  activa      boolean not null default false,
  planes      text[] not null default '{}',     -- vacío = todos los planes
  porcentaje  int not null default 100 check (porcentaje between 0 and 100),
  solo_equipo boolean not null default false,
  updated_at  timestamptz not null default now()
);
alter table public.funciones enable row level security;
revoke all on public.funciones from anon, authenticated;

-- Cubeta estable 0–99 de un hogar para una función: el mismo hogar cae siempre igual (subir de 10 % a 20 % suma
-- hogares sin sacar a los que ya la tenían) y cada función reparte distinto.
create function private.cubeta(p_clave text, p_hogar uuid) returns int
language sql immutable set search_path = '' as $$
  select (abs(hashtextextended(p_clave || ':' || p_hogar::text, 0)) % 100)::int
$$;

create function private.funcion_para(f public.funciones, p_hogar uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select f.activa and (
    exists (select 1 from public.platform_staff s where s.user_id = p_user and s.activo)   -- el equipo ve todo lo encendido
    or (not f.solo_equipo
        and p_hogar is not null
        and (cardinality(f.planes) = 0 or private.plan_efectivo(p_hogar) = any (f.planes))
        and private.cubeta(f.clave, p_hogar) < f.porcentaje))
$$;

-- Funciones encendidas para quien llama, en su hogar activo.
create function public.mis_funciones() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(f.clave order by f.clave), '{}')
    from public.funciones f
   where private.funcion_para(f, private.hogar_activo_de(auth.uid()), auth.uid())
$$;

create function public.consola_funciones() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'clave', f.clave, 'descripcion', f.descripcion, 'activa', f.activa, 'planes', to_jsonb(f.planes), 'porcentaje', f.porcentaje,
            'solo_equipo', f.solo_equipo, 'updated_at', f.updated_at,
            'hogares', case when not f.activa or f.solo_equipo then 0 else
              (select count(*) from public.households h where h.estado = 'activo'
                  and (cardinality(f.planes) = 0 or private.plan_efectivo(h.id) = any (f.planes))
                  and private.cubeta(f.clave, h.id) < f.porcentaje) end)
            order by f.clave), '[]'::jsonb)
            from public.funciones f);
end $$;

create function public.consola_guardar_funcion(p_clave text, p_descripcion text, p_activa boolean, p_planes text[], p_porcentaje int, p_solo_equipo boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('sistema');
  antes public.funciones;
begin
  if coalesce(p_clave, '') !~ '^[a-z][a-z0-9_]{1,40}$' then
    raise exception 'La clave va en minúsculas y sin espacios (ej.: pronostico_gastos).';
  end if;
  if p_porcentaje is null or p_porcentaje not between 0 and 100 then
    raise exception 'El porcentaje va de 0 a 100.';
  end if;
  if exists (select 1 from unnest(coalesce(p_planes, '{}')) p where p not in (select codigo from public.planes)) then
    raise exception 'Hay un plan que no existe.';
  end if;
  select * into antes from public.funciones where clave = p_clave;
  insert into public.funciones (clave, descripcion, activa, planes, porcentaje, solo_equipo)
  values (p_clave, nullif(left(btrim(coalesce(p_descripcion, '')), 200), ''), coalesce(p_activa, false), coalesce(p_planes, '{}'), p_porcentaje, coalesce(p_solo_equipo, false))
  on conflict (clave) do update set descripcion = excluded.descripcion, activa = excluded.activa, planes = excluded.planes,
    porcentaje = excluded.porcentaje, solo_equipo = excluded.solo_equipo, updated_at = now();
  perform private.auditar(s.user_id, s.nombre, 'guardo_funcion', 'funcion', p_clave, p_clave,
    jsonb_build_object('antes', case when antes.clave is not null then jsonb_build_object('activa', antes.activa, 'planes', antes.planes, 'porcentaje', antes.porcentaje, 'solo_equipo', antes.solo_equipo) end,
                       'despues', jsonb_build_object('activa', p_activa, 'planes', p_planes, 'porcentaje', p_porcentaje, 'solo_equipo', p_solo_equipo)));
end $$;

-- Colas y actividad para la pantalla Sistema (conteos, sin datos de hogares).
create function public.consola_sistema() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('sistema');
  return jsonb_build_object(
    'colas', jsonb_build_object(
      'comprobantes_por_revisar', (select count(*) from public.receipts where estado = 'por_revisar'),
      'comprobantes_con_error_24h', (select count(*) from public.receipts where estado = 'error' and created_at > now() - interval '1 day'),
      'campanas_pendientes', (select count(*) from public.campanas where estado in ('programada', 'enviando')),
      'cobros_pendientes', (select count(*) from public.cobros where estado = 'pendiente'),
      'tickets_abiertos', (select count(*) from public.tickets where estado <> 'resuelto'),
      'solicitudes_1581', (select count(*) from public.solicitudes_privacidad where estado in ('recibida', 'en_tramite'))),
    'correos_24h', (select jsonb_build_object('enviados', count(*), 'rebotes', count(*) filter (where estado = 'rebotado'), 'ultimo', max(creado))
                      from public.correos_enviados where creado > now() - interval '1 day'),
    'errores_24h', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'n', n) order by n desc), '[]'::jsonb)
                      from (select tipo, count(*) as n from public.registro_tecnico where created_at > now() - interval '1 day' group by tipo) x),
    'ia_ultima', (select max(creado_en) from public.ia_usos),
    'base', jsonb_build_object('version', current_setting('server_version'), 'migracion', (select max(version) from supabase_migrations.schema_migrations)));
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['mis_funciones()', 'consola_funciones()', 'consola_guardar_funcion(text, text, boolean, text[], int, boolean)', 'consola_sistema()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.cubeta(text, uuid), private.funcion_para(public.funciones, uuid, uuid) from public, anon, authenticated;
