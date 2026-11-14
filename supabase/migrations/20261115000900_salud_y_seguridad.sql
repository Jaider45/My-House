-- Diseño «Admin SaaS» → Estado del sistema: historial de los chequeos de salud (los que llama el monitor externo a
-- /api/salud/<componente> cada pocos minutos) para la disponibilidad de 30 días, la latencia y las barras por día.
-- Y la revisión de seguridad al día con las funciones y tablas nuevas del diseño.

create table public.salud_registros (
  id         bigint generated always as identity primary key,
  componente text not null,
  ok         boolean not null,
  ms         int not null default 0,
  creado     timestamptz not null default now()
);
create index salud_registros_idx on public.salud_registros (componente, creado desc);
alter table public.salud_registros enable row level security;
revoke all on public.salud_registros from anon, authenticated;

-- Un registro por componente cada 4 minutos como mucho (o al cambiar de estado). Purga lo de más de 35 días.
create function public.salud_registrar(p_componente text, p_ok boolean, p_ms int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ultimo public.salud_registros;
begin
  select * into ultimo from public.salud_registros where componente = p_componente order by creado desc limit 1;
  if ultimo.id is not null and ultimo.ok = p_ok and ultimo.creado > now() - interval '4 minutes' then
    return;
  end if;
  insert into public.salud_registros (componente, ok, ms) values (left(p_componente, 20), p_ok, greatest(0, least(p_ms, 600000)));
  if random() < 0.01 then
    delete from public.salud_registros where creado < now() - interval '35 days';
  end if;
end $$;

create function public.consola_salud() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'componentes', (select coalesce(jsonb_object_agg(c.componente, jsonb_build_object(
        'ultimo', (select jsonb_build_object('ok', r.ok, 'creado', r.creado) from public.salud_registros r where r.componente = c.componente order by r.creado desc limit 1),
        'disponibilidad', (select round(100.0 * count(*) filter (where r.ok) / nullif(count(*), 0), 2) from public.salud_registros r
                             where r.componente = c.componente and r.creado > now() - interval '30 days'),
        'latencia', (select round(avg(r.ms)) from public.salud_registros r where r.componente = c.componente and r.ok and r.ms > 5 and r.creado > now() - interval '1 day'),
        'dias', (select coalesce(jsonb_agg(x.estado order by x.dia), '[]'::jsonb) from (
                   select d::date as dia,
                          (select case when count(*) = 0 then 'sin' when count(*) filter (where not r.ok) = 0 then 'ok'
                                       when count(*) filter (where not r.ok) * 2 < count(*) then 'w' else 'e' end
                             from public.salud_registros r
                            where r.componente = c.componente and (r.creado at time zone 'America/Bogota')::date = d::date) as estado
                     from generate_series((now() at time zone 'America/Bogota')::date - 29, (now() at time zone 'America/Bogota')::date, interval '1 day') d) x)
      )), '{}'::jsonb)
      from (select distinct componente from public.salud_registros) c),
    'errores_1h', (select count(*) from public.registro_tecnico where created_at > now() - interval '1 hour'));
end $$;

revoke execute on function public.salud_registrar(text, boolean, int) from public, anon, authenticated;
grant execute on function public.salud_registrar(text, boolean, int) to service_role;
revoke execute on function public.consola_salud() from public, anon;
grant execute on function public.consola_salud() to authenticated;

-- ───────────────────────── revisión de seguridad ─────────────────────────

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
                       'plantilla_estado_meta', 'salud_registrar')
  union all
  select 'tabla_sensible_accesible', t || ' (' || r || ')'
    from unnest(array['auditoria', 'integraciones', 'staff_invitaciones', 'eventos_pasarela', 'cupones', 'cupones_usos',
                      'hogar_notas', 'avisos_enviados', 'eventos', 'correos_enviados', 'campanas', 'hogar_activo',
                      'registro_tecnico', 'respuestas_guardadas', 'categorias_base', 'documento_revisiones',
                      'intentos_ingreso', 'avisos_equipo_enviados', 'ofertas', 'ofertas_cerradas', 'enlaces_clics', 'aliados',
                      'plantillas_whatsapp', 'academia_vistas', 'academia_calificaciones', 'academia_recomendaciones',
                      'academia_talleres', 'academia_inscripciones', 'segmentos', 'salud_registros']) t
   cross join unnest(array['anon', 'authenticated']) r
   where has_table_privilege(r, 'public.' || t, 'select') or has_table_privilege(r, 'public.' || t, 'insert')
      or has_table_privilege(r, 'public.' || t, 'update') or has_table_privilege(r, 'public.' || t, 'delete')
  union all
  select 'bucket_publico', b.id from storage.buckets b where b.public
$$;
revoke execute on function public.revision_seguridad() from public, anon, authenticated;
grant execute on function public.revision_seguridad() to service_role;
