-- Roadmap SaaS S4: métricas del negocio (panel general y analítica), registro de correos enviados y campañas.
--
-- * `households.canal` y `referido_por`: de dónde llegó cada hogar (utm_source o enlace de referido; S5 resuelve
--   el código). Se fijan una vez, al crear el hogar.
-- * `eventos`: hitos de producto para el embudo y el churn. Los escriben triggers (una vez por hogar los de
--   activación); nadie los lee por la API: solo las funciones de la consola.
-- * `correos_enviados`: una fila por correo que envía la app (destinatario enmascarado). El webhook de Resend
--   (/api/correos/webhook) actualiza el estado (entregado, abierto, clic, rebote).
-- * `campanas`: correos a un segmento de hogares. Solo llegan a quienes activaron «Novedades» en Recordatorios
--   (config.correo.novedades, apagado por defecto). Las envía el cron diario.

alter table public.households
  add column canal text check (canal is null or canal ~ '^[\w-]{1,40}$'),
  add column referido_por uuid references public.households (id) on delete set null;
comment on column public.households.canal is 'De dónde llegó el hogar (utm_source o "contador" si vino por referido). Se fija al crear el hogar.';

-- ───────────────────────────── eventos de producto ─────────────────────────────

create table public.eventos (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households on delete cascade,
  tipo         text not null check (tipo in ('registro', 'pagos_fijos_cargados', 'primer_gasto', 'invito_pareja', 'pago', 'cancelacion')),
  creado       timestamptz not null default now()
);
create index eventos_tipo on public.eventos (tipo, creado desc);
-- Los hitos de activación cuentan una sola vez por hogar.
create unique index eventos_unicos on public.eventos (household_id, tipo)
  where tipo in ('registro', 'pagos_fijos_cargados', 'primer_gasto', 'invito_pareja');
alter table public.eventos enable row level security;
revoke all on public.eventos from anon, authenticated;

create function private.registrar_evento(h uuid, t text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.eventos (household_id, tipo) values (h, t) on conflict do nothing
$$;

create function private.evento_pagos_fijos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar_evento(new.household_id, 'pagos_fijos_cargados');
  return null;
end $$;
create trigger eventos_pagos_fijos after insert on public.recurring_rules
  for each row execute function private.evento_pagos_fijos();

create function private.evento_primer_gasto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar_evento(new.household_id, 'primer_gasto');
  return null;
end $$;
create trigger eventos_primer_gasto after insert on public.transactions
  for each row when (new.tipo = 'gasto') execute function private.evento_primer_gasto();

-- Segunda persona con acceso en el hogar = invitó a la pareja.
create function private.evento_pareja() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.members m where m.household_id = new.household_id and m.user_id is not null) >= 2 then
    perform private.registrar_evento(new.household_id, 'invito_pareja');
  end if;
  return null;
end $$;
create trigger eventos_pareja after insert on public.members
  for each row when (new.user_id is not null) execute function private.evento_pareja();

create function private.evento_pago() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar_evento(new.household_id, 'pago');
  return null;
end $$;
create trigger eventos_pago after update on public.cobros
  for each row when (new.estado = 'pagado' and old.estado is distinct from 'pagado') execute function private.evento_pago();

create function private.evento_cancelacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar_evento(new.household_id, 'cancelacion');
  return null;
end $$;
create trigger eventos_cancelacion after update on public.suscripciones
  for each row when (new.estado = 'cancelada' and old.estado <> 'cancelada') execute function private.evento_cancelacion();

-- crear_hogar ahora recibe el canal de llegada (p_ref se resuelve en la migración contadores) y registra el evento.
drop function public.crear_hogar(text, text);
create function public.crear_hogar(p_nombre text, p_nombre_miembro text, p_canal text default null, p_ref text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  h uuid;
  canal text := lower(btrim(coalesce(p_canal, '')));
begin
  if (select auth.uid()) is null then
    raise exception 'no autenticado';
  end if;
  if canal !~ '^[\w-]{1,40}$' then
    canal := null;
  end if;
  insert into public.households (nombre, canal) values (btrim(p_nombre), canal) returning id into h;
  insert into public.members (household_id, user_id, nombre, rol)
    values (h, (select auth.uid()), btrim(p_nombre_miembro), 'admin');
  perform private.sembrar_categorias(h);
  perform private.registrar_evento(h, 'registro');
  return h;
end $$;
revoke execute on function public.crear_hogar(text, text, text, text) from public, anon;
grant execute on function public.crear_hogar(text, text, text, text) to authenticated;

-- ───────────────────────────── correos enviados ─────────────────────────────

create table public.correos_enviados (
  id         bigint generated always as identity primary key,
  resend_id  text unique,
  etiqueta   text not null default 'otro',
  asunto     text not null default '',
  para       text not null default '',   -- enmascarado: nunca se guarda el correo completo
  estado     text not null default 'enviado' check (estado in ('enviado', 'entregado', 'abierto', 'clic', 'rebotado', 'queja')),
  creado     timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index correos_enviados_etiqueta on public.correos_enviados (etiqueta, creado desc);
alter table public.correos_enviados enable row level security;
revoke all on public.correos_enviados from anon, authenticated;
comment on table public.correos_enviados is 'Un registro por correo enviado por la app (destinatario enmascarado). Estados por el webhook de Resend.';

-- ───────────────────────────── campañas ─────────────────────────────

create table public.campanas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(btrim(nombre)) between 1 and 80),
  segmento        text not null check (segmento in ('todos', 'gratis', 'familia', 'prueba', 'mora', 'inactivos')),
  asunto          text not null check (length(btrim(asunto)) between 1 and 150),
  titulo          text not null check (length(btrim(titulo)) between 1 and 150),
  cuerpo          text not null check (length(btrim(cuerpo)) between 1 and 2000),
  boton_texto     text check (boton_texto is null or length(boton_texto) <= 40),
  boton_url       text check (boton_url is null or boton_url ~ '^https?://' or boton_url ~ '^/'),
  programada_para timestamptz,
  estado          text not null default 'borrador' check (estado in ('borrador', 'programada', 'enviando', 'enviada', 'cancelada')),
  alcance         int not null default 0,
  enviados        int not null default 0,
  creada_por      uuid references auth.users (id) on delete set null,
  creada_nombre   text not null default '',
  enviada_en      timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.campanas enable row level security;
revoke all on public.campanas from anon, authenticated;

-- Hogares de un segmento (sin el permiso de novedades: eso lo filtra campana_hogares).
create function private.hogares_segmento(p_segmento text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h.id from public.households h
   where case p_segmento
     when 'todos' then true
     when 'gratis' then h.plan = 'gratis' and not coalesce(h.prueba_hasta > now(), false)
     when 'familia' then h.plan = 'familia'
     when 'prueba' then h.plan = 'gratis' and coalesce(h.prueba_hasta > now(), false)
     when 'mora' then exists (select 1 from public.suscripciones s where s.household_id = h.id and s.estado = 'vencida')
     when 'inactivos' then not exists (select 1 from public.transactions t where t.household_id = h.id and t.created_at > now() - interval '30 days')
     else false
   end
$$;

-- Destinatarios reales de una campaña: el segmento ∩ hogares activos que aceptaron novedades. Solo el cron.
create function public.campana_hogares(p_campana uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h.id
    from private.hogares_segmento((select c.segmento from public.campanas c where c.id = p_campana)) s(id)
    join public.households h on h.id = s.id
   where h.estado = 'activo' and (h.config #>> '{correo,novedades}')::boolean is true
$$;
revoke execute on function public.campana_hogares(uuid) from public, anon, authenticated;
grant execute on function public.campana_hogares(uuid) to service_role;

-- ───────────────────────────── consola: métricas ─────────────────────────────

create function public.consola_metricas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  registrados int;
  pagando int;
  mrr bigint;
  cancel_30 int;
begin
  perform private.exigir_staff('ver_hogares');
  select count(*) into registrados from public.households;
  select count(*), coalesce(sum(case s.periodo when 'anual' then round(s.monto_periodo / 12.0)::bigint else s.monto_periodo end), 0)
    into pagando, mrr
    from public.suscripciones s where s.estado in ('activa', 'vencida');
  select count(*) into cancel_30 from public.eventos where tipo = 'cancelacion' and creado > now() - interval '30 days';

  return jsonb_build_object(
    'registrados', registrados,
    'activos_30d', (select count(distinct t.household_id) from public.transactions t where t.created_at > now() - interval '30 days'),
    'nuevos_30d', (select count(*) from public.households where created_at > now() - interval '30 days'),
    'en_prueba', (select count(*) from public.households where plan = 'gratis' and prueba_hasta > now()),
    'pagando', pagando,
    'pagando_familia', (select count(*) from public.suscripciones where estado in ('activa', 'vencida') and plan = 'familia'),
    'pagando_contador', (select count(*) from public.suscripciones where estado in ('activa', 'vencida') and plan = 'contador'),
    'mrr', mrr,
    'arpu', case when pagando = 0 then 0 else round(mrr::numeric / pagando)::bigint end,
    'conversion_pct', case when registrados = 0 then null else round(100.0 * pagando / registrados, 1) end,
    'churn_pct', case when pagando + cancel_30 = 0 then null else round(100.0 * cancel_30 / (pagando + cancel_30), 1) end,
    'embudo', jsonb_build_object(
      'registrados', registrados,
      'pagos_fijos', (select count(*) from public.eventos where tipo = 'pagos_fijos_cargados'),
      'primer_gasto', (select count(*) from public.eventos where tipo = 'primer_gasto'),
      'pareja', (select count(*) from public.eventos where tipo = 'invito_pareja'),
      'pagan', pagando),
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', to_char(w.d, 'YYYY-MM-DD'), 'n',
                  (select count(*) from public.households h where date_trunc('week', h.created_at at time zone 'America/Bogota') = w.d)) order by w.d), '[]'::jsonb)
                from (select date_trunc('week', now() at time zone 'America/Bogota') - make_interval(weeks => n) as d from generate_series(5, 0, -1) n) w),
    'meses', (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m.d, 'YYYY-MM'), 'cobrado',
                 coalesce((select sum(c.monto) from public.cobros c where c.pagado_en is not null
                            and date_trunc('month', c.pagado_en at time zone 'America/Bogota') = m.d), 0)) order by m.d), '[]'::jsonb)
              from (select date_trunc('month', now() at time zone 'America/Bogota') - make_interval(months => n) as d from generate_series(11, 0, -1) n) m));
end $$;

create function public.consola_analitica() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  filas jsonb := '[]'::jsonb;
  c record;
  ret jsonb;
  activos int;
  k int;
  mes_actual date := (date_trunc('month', now() at time zone 'America/Bogota'))::date;
begin
  perform private.exigir_staff('ver_hogares');

  for c in
    select (date_trunc('month', h.created_at at time zone 'America/Bogota'))::date as mes, count(*)::int as n, array_agg(h.id) as ids
      from public.households h
     where h.created_at >= (mes_actual - interval '5 months')
     group by 1 order by 1
  loop
    ret := '[]'::jsonb;
    for k in 0..5 loop
      if c.mes + make_interval(months => k) > mes_actual then
        ret := ret || 'null'::jsonb;
      else
        select count(distinct t.household_id) into activos
          from public.transactions t
         where t.household_id = any (c.ids)
           and date_trunc('month', t.created_at at time zone 'America/Bogota') = c.mes + make_interval(months => k);
        ret := ret || to_jsonb(round(100.0 * activos / c.n));
      end if;
    end loop;
    filas := filas || jsonb_build_object('mes', to_char(c.mes, 'YYYY-MM'), 'hogares', c.n, 'ret', ret);
  end loop;

  return jsonb_build_object(
    'cohortes', filas,
    'canales', (select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'hogares', n, 'pagando', pagando) order by n desc), '[]'::jsonb)
                from (select coalesce(nullif(btrim(h.canal), ''), 'directo') as canal, count(*)::int as n,
                             (count(*) filter (where exists (select 1 from public.suscripciones s where s.household_id = h.id and s.estado in ('activa', 'vencida'))))::int as pagando
                        from public.households h group by 1) x),
    'mov_semana_mediana', (select coalesce(round(percentile_cont(0.5) within group (order by n))::int, 0)
                             from (select count(*) as n from public.transactions where created_at > now() - interval '7 days' group by household_id) x),
    'pareja_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where usuarios >= 2) / count(*)) end
                     from (select h.id, (select count(*) from public.members m where m.household_id = h.id and m.user_id is not null) as usuarios
                             from public.households h
                            where exists (select 1 from public.transactions t where t.household_id = h.id and t.created_at > now() - interval '30 days')) x));
end $$;

create function public.consola_correos_resumen()
returns table (etiqueta text, enviados int, entregados int, abiertos int, clics int, rebotados int, ultimo timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return query
    select c.etiqueta, count(*)::int,
           (count(*) filter (where c.estado in ('entregado', 'abierto', 'clic')))::int,
           (count(*) filter (where c.estado in ('abierto', 'clic')))::int,
           (count(*) filter (where c.estado = 'clic'))::int,
           (count(*) filter (where c.estado in ('rebotado', 'queja')))::int,
           max(c.creado)
      from public.correos_enviados c
     where c.creado > now() - interval '30 days'
     group by c.etiqueta
     order by 2 desc;
end $$;

-- ───────────────────────────── consola: campañas ─────────────────────────────

create function public.consola_segmentos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  resultado jsonb := '{}'::jsonb;
  s text;
begin
  perform private.exigir_staff('campanas');
  foreach s in array array['todos', 'gratis', 'familia', 'prueba', 'mora', 'inactivos'] loop
    resultado := resultado || jsonb_build_object(s, (
      select jsonb_build_object('hogares', count(*), 'con_permiso',
               count(*) filter (where h.estado = 'activo' and (h.config #>> '{correo,novedades}')::boolean is true))
        from private.hogares_segmento(s) x(id) join public.households h on h.id = x.id));
  end loop;
  return resultado;
end $$;

create function public.consola_campanas() returns setof public.campanas
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('campanas');
  return query select * from public.campanas order by created_at desc limit 100;
end $$;

create function public.consola_guardar_campana(p_id uuid, p_nombre text, p_segmento text, p_asunto text, p_titulo text,
                                               p_cuerpo text, p_boton_texto text, p_boton_url text, p_programada timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('campanas');
  actual public.campanas;
  nueva uuid;
  estado_nuevo text := case when p_programada is null then 'borrador' else 'programada' end;
begin
  if p_programada is not null and p_programada < now() - interval '5 minutes' then
    raise exception 'La fecha de envío ya pasó.';
  end if;
  if p_id is not null then
    select * into actual from public.campanas where id = p_id for update;
    if actual.id is null then
      raise exception 'No encontramos esa campaña.';
    end if;
    if actual.estado not in ('borrador', 'programada', 'cancelada') then
      raise exception 'Una campaña enviada no se puede editar. Crea otra.';
    end if;
    update public.campanas
       set nombre = btrim(p_nombre), segmento = p_segmento, asunto = btrim(p_asunto), titulo = btrim(p_titulo),
           cuerpo = btrim(p_cuerpo), boton_texto = nullif(btrim(coalesce(p_boton_texto, '')), ''),
           boton_url = nullif(btrim(coalesce(p_boton_url, '')), ''), programada_para = p_programada, estado = estado_nuevo
     where id = p_id;
    nueva := p_id;
  else
    insert into public.campanas (nombre, segmento, asunto, titulo, cuerpo, boton_texto, boton_url, programada_para, estado, creada_por, creada_nombre)
    values (btrim(p_nombre), p_segmento, btrim(p_asunto), btrim(p_titulo), btrim(p_cuerpo),
            nullif(btrim(coalesce(p_boton_texto, '')), ''), nullif(btrim(coalesce(p_boton_url, '')), ''),
            p_programada, estado_nuevo, s.user_id, s.nombre)
    returning id into nueva;
  end if;
  perform private.auditar(s.user_id, s.nombre,
                          case when p_id is null then 'creo_campana' when estado_nuevo = 'programada' then 'programo_campana' else 'edito_campana' end,
                          'campana', nueva::text, btrim(p_nombre),
                          jsonb_build_object('segmento', p_segmento, 'programada_para', p_programada));
  return nueva;
end $$;

create function public.consola_cancelar_campana(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('campanas');
  actual public.campanas;
begin
  update public.campanas set estado = 'cancelada', programada_para = null
   where id = p_id and estado in ('borrador', 'programada') returning * into actual;
  if actual.id is null then
    raise exception 'La campaña no existe o ya se envió.';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'cancelo_campana', 'campana', p_id::text, actual.nombre);
end $$;

-- ───────────────────────────── permisos y revisión ─────────────────────────────

-- Resend suma el secreto del webhook (estados de los correos).
create or replace function private.campos_integracion(p text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p
    when 'resend'    then '{"config": ["remitente"], "secretos": ["api_key", "webhook_secret"]}'
    when 'wompi'     then '{"config": ["llave_publica"], "secretos": ["integridad", "eventos"]}'
    when 'whatsapp'  then '{"config": ["phone_number_id", "waba_id", "verify_token"], "secretos": ["token", "app_secret"]}'
    when 'anthropic' then '{"config": ["modelo"], "secretos": ["api_key"]}'
    when 'openai'    then '{"config": ["modelo"], "secretos": ["api_key"]}'
  end::jsonb
$$;

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
                      'hogar_notas', 'avisos_enviados', 'eventos', 'correos_enviados', 'campanas']) t
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
  foreach f in array array['consola_metricas()', 'consola_analitica()', 'consola_correos_resumen()', 'consola_segmentos()',
                           'consola_campanas()',
                           'consola_guardar_campana(uuid, text, text, text, text, text, text, text, timestamptz)',
                           'consola_cancelar_campana(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
