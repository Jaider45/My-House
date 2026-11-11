-- Una campaña grande no cabe en una sola corrida del cron (2 correos por segundo contra el tope de 300 s de la
-- función): se envía por tandas y continúa en la siguiente, sin repetir a nadie.
alter table public.campanas
  add column cursor_hogar uuid,                       -- último hogar al que ya se le envió
  add column intentos smallint not null default 0;    -- tandas usadas (corta un ciclo si algo falla siempre)

-- Destinatarios que faltan, en orden estable por id y desde el cursor.
create or replace function public.campana_hogares(p_campana uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h.id
    from public.campanas c
    join private.hogares_segmento(c.segmento) s(id) on true
    join public.households h on h.id = s.id
   where c.id = p_campana
     and h.estado = 'activo'
     and (h.config #>> '{correo,novedades}')::boolean is true
     and (c.cursor_hogar is null or h.id > c.cursor_hogar)
   order by h.id
$$;
revoke execute on function public.campana_hogares(uuid) from public, anon, authenticated;
grant execute on function public.campana_hogares(uuid) to service_role;

-- Reclama una campaña programada (o una tanda pendiente) para esta corrida. Devuelve null si no hay nada que hacer.
create function public.campana_reclamar() returns public.campanas
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.campanas;
begin
  select * into c from public.campanas
   where (estado = 'programada' and programada_para <= now())
      or (estado = 'enviando' and intentos < 20)
   order by programada_para nulls last
   limit 1
   for update skip locked;
  if c.id is null then
    return null;
  end if;
  update public.campanas set estado = 'enviando', intentos = intentos + 1 where id = c.id returning * into c;
  return c;
end $$;

-- Guarda el avance de una tanda; `p_termino` la cierra como enviada.
create function public.campana_avance(p_id uuid, p_cursor uuid, p_enviados int, p_alcance int, p_termino boolean)
returns void
language sql volatile security definer set search_path = '' as $$
  update public.campanas
     set cursor_hogar = coalesce(p_cursor, cursor_hogar),
         enviados = enviados + p_enviados,
         alcance = alcance + p_alcance,
         estado = case when p_termino then 'enviada' else estado end,
         enviada_en = case when p_termino then now() else enviada_en end
   where id = p_id
$$;

revoke execute on function public.campana_reclamar() from public, anon, authenticated;
revoke execute on function public.campana_avance(uuid, uuid, int, int, boolean) from public, anon, authenticated;
grant execute on function public.campana_reclamar() to service_role;
grant execute on function public.campana_avance(uuid, uuid, int, int, boolean) to service_role;

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
                       'campana_reclamar', 'campana_avance')
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
