-- Integraciones conectables desde la consola (correo, pagos, WhatsApp, IA) sin tocar código ni variables de entorno,
-- y una revisión de seguridad que las pruebas corren en cada cambio.
--
-- Secretos: van cifrados en Supabase Vault (vault.secrets). La tabla `integraciones` guarda solo valores no secretos
-- y, por cada secreto, el id en Vault y sus últimos 4 caracteres para reconocerlo. El equipo puede escribir un secreto
-- pero nunca leerlo de vuelta; solo el servidor (service_role) lo descifra con integracion_leer().

create table public.integraciones (
  proveedor        text primary key check (proveedor in ('resend', 'wompi', 'whatsapp', 'anthropic', 'openai')),
  config           jsonb not null default '{}'::jsonb,
  secretos         jsonb not null default '{}'::jsonb,   -- campo → {"id": uuid de Vault, "ultimos": "…1234"}
  activa           boolean not null default true,
  verificada_en    timestamptz,
  verificacion     jsonb,                               -- {"ok": bool, "detalle": texto}
  ultimo_evento    timestamptz,                         -- último webhook recibido (WhatsApp, Wompi)
  actualizada_en   timestamptz not null default now(),
  actualizada_por  uuid references auth.users (id) on delete set null
);
alter table public.integraciones enable row level security;
revoke all on public.integraciones from anon, authenticated;
comment on table public.integraciones is 'Proveedores conectados desde la consola. Secretos en Vault; aquí solo sus ids y últimos 4 caracteres.';

-- Campos permitidos por proveedor: nada fuera de esta lista se guarda.
create function private.campos_integracion(p text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p
    when 'resend'    then '{"config": ["remitente"], "secretos": ["api_key"]}'
    when 'wompi'     then '{"config": ["llave_publica"], "secretos": ["integridad", "eventos"]}'
    when 'whatsapp'  then '{"config": ["phone_number_id", "waba_id", "verify_token"], "secretos": ["token", "app_secret"]}'
    when 'anthropic' then '{"config": ["modelo"], "secretos": ["api_key"]}'
    when 'openai'    then '{"config": ["modelo"], "secretos": ["api_key"]}'
  end::jsonb
$$;

create function public.consola_integraciones()
returns table (proveedor text, config jsonb, secretos jsonb, activa boolean, verificada_en timestamptz, verificacion jsonb,
               ultimo_evento timestamptz, actualizada_en timestamptz, actualizada_por text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('sistema');
  return query
    select i.proveedor, i.config,
           (select coalesce(jsonb_object_agg(k, jsonb_build_object('ultimos', v ->> 'ultimos')), '{}'::jsonb) from jsonb_each(i.secretos) s(k, v)),
           i.activa, i.verificada_en, i.verificacion, i.ultimo_evento, i.actualizada_en, p.nombre
      from public.integraciones i left join public.platform_staff p on p.user_id = i.actualizada_por;
end $$;

-- Guarda configuración y secretos. Un secreto vacío o ausente conserva el que había. Queda en la auditoría (sin valores).
create function public.consola_guardar_integracion(p_proveedor text, p_config jsonb, p_secretos jsonb, p_activa boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('sistema');
  campos jsonb := private.campos_integracion(p_proveedor);
  actual public.integraciones;
  mapa jsonb;
  k text;
  v text;
  vid uuid;
  cambiados text[] := '{}';
begin
  if campos is null then
    raise exception 'Esa integración no existe.';
  end if;
  if jsonb_typeof(coalesce(p_config, '{}')) <> 'object' or jsonb_typeof(coalesce(p_secretos, '{}')) <> 'object' then
    raise exception 'Datos no válidos.';
  end if;
  for k in select jsonb_object_keys(coalesce(p_config, '{}')) loop
    if not (campos -> 'config') ? k then raise exception 'Campo no permitido: %', k; end if;
    if jsonb_typeof(p_config -> k) <> 'string' or length(p_config ->> k) > 500 then raise exception 'Valor no válido en %', k; end if;
  end loop;
  for k in select jsonb_object_keys(coalesce(p_secretos, '{}')) loop
    if not (campos -> 'secretos') ? k then raise exception 'Campo no permitido: %', k; end if;
    if jsonb_typeof(p_secretos -> k) <> 'string' or length(p_secretos ->> k) > 4000 then raise exception 'Valor no válido en %', k; end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended('integracion:' || p_proveedor, 0));
  select * into actual from public.integraciones where proveedor = p_proveedor;
  mapa := coalesce(actual.secretos, '{}'::jsonb);

  for k, v in select key, btrim(value) from jsonb_each_text(coalesce(p_secretos, '{}')) loop
    continue when v = '';
    vid := nullif(mapa -> k ->> 'id', '')::uuid;
    if vid is not null and exists (select 1 from vault.secrets where id = vid) then
      perform vault.update_secret(vid, v);
    else
      vid := vault.create_secret(v, 'integracion/' || p_proveedor || '/' || k || '/' || gen_random_uuid(), 'Integración ' || p_proveedor);
    end if;
    mapa := jsonb_set(mapa, array[k], jsonb_build_object('id', vid, 'ultimos', '…' || right(v, 4)));
    cambiados := cambiados || k;
  end loop;

  insert into public.integraciones as i (proveedor, config, secretos, activa, actualizada_en, actualizada_por)
  values (p_proveedor, coalesce(p_config, '{}'), mapa, coalesce(p_activa, true), now(), s.user_id)
  on conflict (proveedor) do update
     set config = coalesce(p_config, i.config), secretos = mapa, activa = coalesce(p_activa, i.activa),
         verificada_en = null, verificacion = null, actualizada_en = now(), actualizada_por = s.user_id;

  perform private.auditar(s.user_id, s.nombre, case when actual.proveedor is null then 'conecto_integracion' else 'edito_integracion' end,
                          'integracion', p_proveedor, p_proveedor,
                          jsonb_build_object('secretos_cambiados', to_jsonb(cambiados), 'activa', coalesce(p_activa, true)));
end $$;

create function public.consola_desconectar_integracion(p_proveedor text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('sistema');
  actual public.integraciones;
begin
  select * into actual from public.integraciones where proveedor = p_proveedor for update;
  if actual.proveedor is null then
    raise exception 'Esa integración no está conectada.';
  end if;
  delete from vault.secrets where id in (select (v ->> 'id')::uuid from jsonb_each(actual.secretos) x(k, v));
  delete from public.integraciones where proveedor = p_proveedor;
  perform private.auditar(s.user_id, s.nombre, 'desconecto_integracion', 'integracion', p_proveedor, p_proveedor);
end $$;

-- Resultado del botón «Probar conexión» (lo prueba el servidor, que es quien tiene los secretos).
create function public.consola_registrar_verificacion(p_proveedor text, p_ok boolean, p_detalle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.exigir_staff('sistema');
  update public.integraciones
     set verificada_en = now(), verificacion = jsonb_build_object('ok', p_ok, 'detalle', left(coalesce(p_detalle, ''), 500))
   where proveedor = p_proveedor;
end $$;

-- Solo el servidor (service_role): configuración + secretos descifrados de una integración activa.
create function public.integracion_leer(p_proveedor text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'config', i.config,
           'secretos', (select coalesce(jsonb_object_agg(k, d.decrypted_secret), '{}'::jsonb)
                          from jsonb_each(i.secretos) s(k, v)
                          join vault.decrypted_secrets d on d.id = (v ->> 'id')::uuid))
    from public.integraciones i
   where i.proveedor = p_proveedor and i.activa
$$;

create function public.integracion_evento(p_proveedor text) returns void
language sql volatile security definer set search_path = '' as $$
  update public.integraciones set ultimo_evento = now() where proveedor = p_proveedor
$$;

do $$
declare
  f text;
begin
  foreach f in array array['consola_integraciones()', 'consola_guardar_integracion(text, jsonb, jsonb, boolean)',
                           'consola_desconectar_integracion(text)', 'consola_registrar_verificacion(text, boolean, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['integracion_leer(text)', 'integracion_evento(text)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ───────────────────────────── límite de cobros ─────────────────────────────

-- Frena la creación masiva de cobros (cada clic en «Pagar» crea uno): 20 por hogar por hora.
create or replace function private.limite_cobros() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and new.motivo = 'alta'
     and (select count(*) from public.cobros where household_id = new.household_id and creado > now() - interval '1 hour') >= 20 then
    raise exception 'Hiciste demasiados intentos de pago seguidos. Espera un rato y vuelve a intentarlo.';
  end if;
  return new;
end $$;
create trigger cobros_limite before insert on public.cobros for each row execute function private.limite_cobros();

-- ───────────────────────────── revisión de seguridad ─────────────────────────────

-- Segunda capa: además de RLS sin políticas, sin permisos directos para quien llama desde el navegador.
revoke all on public.avisos_enviados from anon, authenticated;

-- Hallazgos de configuración insegura. tests/rls/seguridad.test.ts exige que la lista esté vacía.
create function public.revision_seguridad() returns table (tipo text, objeto text)
language sql stable security definer set search_path = '' as $$
  -- Toda tabla de public con RLS.
  select 'tabla_sin_rls', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  -- Vistas de public con security_invoker (si no, se saltan el RLS de sus tablas).
  select 'vista_sin_security_invoker', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any (c.reloptions) or 'security_invoker=on' = any (c.reloptions), false)
  union all
  -- Sin sesión (anon) solo se pueden ver invitaciones.
  select 'funcion_publica_para_anon', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('ver_invitacion', 'consola_ver_invitacion')
  union all
  -- Funciones con permisos de dueño deben fijar search_path (evita secuestro de funciones).
  select 'definer_sin_search_path', n.nspname || '.' || p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)
  union all
  -- Lo que solo debe llamar el servidor no lo puede llamar una persona con sesión.
  select 'funcion_de_servidor_expuesta', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname in ('registrar_pago_wompi', 'procesar_vencimientos', 'integracion_leer', 'integracion_evento',
                       'correos_de_usuarios', 'revision_seguridad', 'custom_access_token_hook')
  union all
  -- Tablas sensibles sin ningún permiso directo para anon ni authenticated.
  select 'tabla_sensible_accesible', t || ' (' || r || ')'
    from unnest(array['auditoria', 'integraciones', 'staff_invitaciones', 'eventos_pasarela', 'cupones', 'cupones_usos',
                      'hogar_notas', 'avisos_enviados']) t
   cross join unnest(array['anon', 'authenticated']) r
   where has_table_privilege(r, 'public.' || t, 'select') or has_table_privilege(r, 'public.' || t, 'insert')
      or has_table_privilege(r, 'public.' || t, 'update') or has_table_privilege(r, 'public.' || t, 'delete')
  union all
  select 'bucket_publico', b.id from storage.buckets b where b.public
$$;
revoke execute on function public.revision_seguridad() from public, anon, authenticated;
grant execute on function public.revision_seguridad() to service_role;
