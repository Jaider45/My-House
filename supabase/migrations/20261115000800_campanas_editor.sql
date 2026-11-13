-- Diseño «Admin SaaS» → Correos y campañas: editor de bloques, asunto B (prueba A/B sobre un % del segmento),
-- vista previa, segmentos propios (plan + situación del hogar + actividad), correos automáticos que se pueden apagar
-- y avisos legales obligatorios que salen como campaña transaccional (a todas las personas con cuenta, sin permiso
-- de novedades porque no son publicidad).

create table public.segmentos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(btrim(nombre)) between 3 and 60),
  plan        text not null default 'todos' check (plan in ('todos', 'gratis', 'familia', 'contador', 'pago', 'prueba')),
  condiciones text[] not null default '{}',
  actividad   text not null default 'cualquiera' check (actividad in ('cualquiera', 'activos', 'inactivos')),
  creado_por  text,
  created_at  timestamptz not null default now(),
  check (condiciones <@ array['presupuesto_excedido', 'tope_dian', 'fondo_atrasado', 'sin_fondo', 'varias_deudas', 'un_miembro_14d', 'sin_registro_7d']::text[])
);
alter table public.segmentos enable row level security;
revoke all on public.segmentos from anon, authenticated;

alter table public.campanas
  add column bloques          jsonb check (bloques is null or jsonb_typeof(bloques) = 'array'),
  add column asunto_b         text check (asunto_b is null or char_length(asunto_b) <= 150),
  add column prueba_ab_pct    int not null default 0 check (prueba_ab_pct between 0 and 50),
  add column vista_previa     text check (vista_previa is null or char_length(vista_previa) <= 150),
  add column segmento_propio  uuid references public.segmentos on delete set null,
  add column transaccional    boolean not null default false;
alter table public.campanas drop constraint campanas_segmento_check;
alter table public.campanas add constraint campanas_segmento_check check (segmento in ('todos', 'gratis', 'familia', 'prueba', 'mora', 'inactivos', 'propio'));
alter table public.campanas drop constraint campanas_titulo_check;
alter table public.campanas add constraint campanas_titulo_check check (char_length(titulo) <= 150);
alter table public.campanas drop constraint campanas_asunto_check;
alter table public.campanas add constraint campanas_asunto_check check (char_length(asunto) <= 150);
alter table public.campanas drop constraint campanas_cuerpo_check;
alter table public.campanas add constraint campanas_cuerpo_check check (char_length(cuerpo) <= 2000);

-- Hogares de un segmento propio.
create function private.hogares_segmento_propio(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h.id from public.households h, public.segmentos s
   where s.id = p_id and h.estado = 'activo'
     and case s.plan
       when 'todos' then true
       when 'gratis' then h.plan = 'gratis' and not coalesce(h.prueba_hasta > now(), false)
       when 'familia' then h.plan = 'familia'
       when 'contador' then h.plan = 'contador'
       when 'pago' then h.plan <> 'gratis'
       when 'prueba' then h.plan = 'gratis' and coalesce(h.prueba_hasta > now(), false)
       else false end
     and case s.actividad
       when 'activos' then exists (select 1 from public.transactions t where t.household_id = h.id and t.origen <> 'recurrente' and t.created_at > now() - interval '30 days')
       when 'inactivos' then not exists (select 1 from public.transactions t where t.household_id = h.id and t.origen <> 'recurrente' and t.created_at > now() - interval '30 days')
       else true end
     and not exists (select 1 from unnest(s.condiciones) c where not private.condicion_academia(c, h.id))
$$;

-- Destinatarios que faltan: segmento fijo o propio; con permiso de novedades salvo los avisos transaccionales.
create or replace function public.campana_hogares(p_campana uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h.id
    from public.campanas c
    join lateral (select x from private.hogares_segmento(c.segmento) x where c.segmento <> 'propio'
                  union all select y from private.hogares_segmento_propio(c.segmento_propio) y where c.segmento = 'propio') s(id) on true
    join public.households h on h.id = s.id
   where c.id = p_campana
     and h.estado = 'activo'
     and (c.transaccional or (h.config #>> '{correo,novedades}')::boolean is true)
     and (c.cursor_hogar is null or h.id > c.cursor_hogar)
   order by h.id
$$;
revoke execute on function public.campana_hogares(uuid) from public, anon, authenticated;
grant execute on function public.campana_hogares(uuid) to service_role;

-- Segmentos fijos y propios con sus conteos: hogares, con permiso y personas (administradores con cuenta).
create function public.consola_segmentos_todos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('campanas');
  return jsonb_build_object(
    'propios', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'plan', s.plan, 'condiciones', to_jsonb(s.condiciones),
                  'actividad', s.actividad,
                  'hogares', (select count(*) from private.hogares_segmento_propio(s.id)),
                  'con_permiso', (select count(*) from private.hogares_segmento_propio(s.id) x(id) join public.households h on h.id = x.id
                                    where (h.config #>> '{correo,novedades}')::boolean is true),
                  'personas', (select count(*) from private.hogares_segmento_propio(s.id) x(id) join public.members m on m.household_id = x.id
                                 where m.rol = 'admin' and m.user_id is not null))
                  order by s.nombre), '[]'::jsonb) from public.segmentos s));
end $$;

create function public.consola_guardar_segmento(p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('campanas');
  nid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if coalesce((p ->> 'borrar')::boolean, false) then
    delete from public.segmentos where id = nid;
  elsif nid is null then
    insert into public.segmentos (nombre, plan, condiciones, actividad, creado_por)
    values (btrim(p ->> 'nombre'), coalesce(p ->> 'plan', 'todos'), coalesce(array(select jsonb_array_elements_text(p -> 'condiciones')), '{}'),
            coalesce(p ->> 'actividad', 'cualquiera'), s.nombre);
  else
    update public.segmentos set nombre = btrim(p ->> 'nombre'), plan = coalesce(p ->> 'plan', 'todos'),
      condiciones = coalesce(array(select jsonb_array_elements_text(p -> 'condiciones')), '{}'), actividad = coalesce(p ->> 'actividad', 'cualquiera')
     where id = nid;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_segmento', 'segmento', coalesce(nid::text, ''), btrim(p ->> 'nombre'), p - 'id');
end $$;

-- Editor de campañas: guardar diseño, audiencia y envío (borrador o programada).
create function public.consola_guardar_campana_editor(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('campanas');
  nid uuid := nullif(p ->> 'id', '')::uuid;
  prog timestamptz := nullif(p ->> 'programada_para', '')::timestamptz;
  actual public.campanas;
  seg text := coalesce(p ->> 'segmento', 'gratis');
begin
  if prog is not null and prog < now() - interval '5 minutes' then
    raise exception 'La fecha de envío ya pasó.';
  end if;
  if seg = 'propio' and nullif(p ->> 'segmento_propio', '') is null then
    raise exception 'Elige el segmento.';
  end if;
  if prog is not null and (char_length(btrim(coalesce(p ->> 'asunto', ''))) = 0 or jsonb_array_length(coalesce(p -> 'bloques', '[]')) = 0) then
    raise exception 'Para programarla, escribe el asunto y agrega al menos un bloque.';
  end if;
  if nid is not null then
    select * into actual from public.campanas where id = nid for update;
    if actual.id is null then
      raise exception 'No encontramos esa campaña.';
    end if;
    if actual.estado not in ('borrador', 'programada', 'cancelada') or actual.transaccional then
      raise exception 'Esta campaña ya salió: no se puede editar.';
    end if;
    update public.campanas set nombre = btrim(p ->> 'nombre'), segmento = seg, segmento_propio = nullif(p ->> 'segmento_propio', '')::uuid,
      asunto = coalesce(btrim(p ->> 'asunto'), ''), asunto_b = nullif(btrim(coalesce(p ->> 'asunto_b', '')), ''),
      prueba_ab_pct = case when nullif(btrim(coalesce(p ->> 'asunto_b', '')), '') is null then 0 else coalesce((p ->> 'prueba_ab_pct')::int, 20) end,
      vista_previa = nullif(btrim(coalesce(p ->> 'vista_previa', '')), ''), bloques = coalesce(p -> 'bloques', '[]'),
      titulo = coalesce(p ->> 'titulo', ''), cuerpo = coalesce(p ->> 'cuerpo', ''),
      programada_para = prog, estado = case when prog is null then 'borrador' else 'programada' end
     where id = nid;
  else
    insert into public.campanas (nombre, segmento, segmento_propio, asunto, asunto_b, prueba_ab_pct, vista_previa, bloques, titulo, cuerpo,
                                 programada_para, estado, creada_por, creada_nombre)
    values (coalesce(nullif(btrim(p ->> 'nombre'), ''), 'Campaña sin nombre'), seg, nullif(p ->> 'segmento_propio', '')::uuid, coalesce(btrim(p ->> 'asunto'), ''),
            nullif(btrim(coalesce(p ->> 'asunto_b', '')), ''), case when nullif(btrim(coalesce(p ->> 'asunto_b', '')), '') is null then 0 else coalesce((p ->> 'prueba_ab_pct')::int, 20) end,
            nullif(btrim(coalesce(p ->> 'vista_previa', '')), ''), coalesce(p -> 'bloques', '[]'), coalesce(p ->> 'titulo', ''), coalesce(p ->> 'cuerpo', ''),
            prog, case when prog is null then 'borrador' else 'programada' end, s.user_id, s.nombre)
    returning id into nid;
  end if;
  perform private.auditar(s.user_id, s.nombre, case when prog is null then 'guardo_campana' else 'programo_campana' end, 'campana', nid::text,
                          coalesce(p ->> 'nombre', ''), jsonb_build_object('segmento', seg, 'programada_para', prog));
  return nid;
end $$;

-- Resultados por campaña y variante (correos_enviados con la etiqueta campana-<id>-a|b).
create function public.consola_comunicaciones() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'kpis', (select jsonb_build_object('enviados', count(*),
               'entregados', count(*) filter (where estado in ('entregado', 'abierto', 'clic')),
               'abiertos', count(*) filter (where estado in ('abierto', 'clic')),
               'clics', count(*) filter (where estado = 'clic'))
               from public.correos_enviados where creado > now() - interval '30 days'),
    'bajas_30d', (select count(distinct user_id) from public.consentimientos where tipo = 'comunicaciones' and not aceptado and created_at > now() - interval '30 days'),
    'campanas', (select coalesce(jsonb_object_agg(c.id, jsonb_build_object(
        'a', (select jsonb_build_object('n', count(*), 'abiertos', count(*) filter (where e.estado in ('abierto', 'clic')), 'clics', count(*) filter (where e.estado = 'clic'))
                from public.correos_enviados e where e.etiqueta = 'campana-' || c.id || '-a'),
        'b', (select jsonb_build_object('n', count(*), 'abiertos', count(*) filter (where e.estado in ('abierto', 'clic')), 'clics', count(*) filter (where e.estado = 'clic'))
                from public.correos_enviados e where e.etiqueta = 'campana-' || c.id || '-b'))), '{}'::jsonb)
        from public.campanas c where c.estado in ('enviando', 'enviada')));
end $$;

-- Avisos legales: la versión que entra en vigencia en ≤ 10 días sale como campaña transaccional (por tandas).
create or replace function public.legal_avisos_pendientes() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb := '[]'::jsonb;
  v record;
begin
  for v in
    update public.documento_versiones x set aviso_enviado_en = now()
      from public.documentos_legales d
     where d.clave = x.documento and x.estado = 'publicada' and x.avisar_correo and x.aviso_enviado_en is null
       and x.vigente_desde - (now() at time zone 'America/Bogota')::date between 0 and 10
    returning d.nombre, d.clave, x.version, x.vigente_desde, x.resumen
  loop
    insert into public.campanas (nombre, segmento, asunto, titulo, cuerpo, boton_texto, boton_url, programada_para, estado, creada_nombre, transaccional, bloques)
    values (left('Aviso legal: ' || v.nombre || ' v' || v.version, 80), 'todos', left('Actualizamos ' || lower(v.nombre), 150), left('Actualizamos ' || lower(v.nombre), 150),
            left(coalesce(nullif(v.resumen, ''), 'Cambiamos este documento.') || ' La versión ' || v.version || ' rige desde el ' || to_char(v.vigente_desde, 'DD/MM/YYYY') || '.', 2000),
            'Leer el documento', case v.clave when 'politica_datos' then '/privacidad' when 'terminos' then '/terminos' else '/legal/' || v.clave end,
            now(), 'programada', 'Legal (automático)', true, null);
    r := r || jsonb_build_object('documento', v.nombre, 'version', v.version);
  end loop;
  return r;
end $$;

-- La campaña reclamada trae ahora sus columnas nuevas (devuelve la fila completa).
do $$
declare
  f text;
begin
  foreach f in array array['consola_segmentos_todos()', 'consola_guardar_segmento(jsonb)', 'consola_guardar_campana_editor(jsonb)', 'consola_comunicaciones()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.hogares_segmento_propio(uuid) from public, anon, authenticated;

-- Correos automáticos que el equipo puede apagar (Consola → Correos y campañas → Correos automáticos).
insert into public.plataforma_config (clave, valor) values ('correos_apagados', '[]') on conflict (clave) do nothing;

create or replace function public.consola_guardar_ajuste(p_clave text, p_valor jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff;
  antes jsonb;
  k text;
  v jsonb;
begin
  s := private.exigir_staff(case when p_clave = 'correos_apagados' then 'campanas' else 'sistema' end::public.permiso_staff);
  select valor into antes from public.plataforma_config where clave = p_clave for update;
  if antes is null or p_clave not in ('empresa', 'envios', 'cobro_reintentos', 'cobro_dia_gratis', 'factura', 'avisos_equipo', 'limites_app', 'correos_apagados') then
    raise exception 'Ese ajuste no existe.';
  end if;
  if jsonb_typeof(p_valor) = 'object' then
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
    when 'avisos_equipo' then
      for k, v in select * from jsonb_each(p_valor) loop
        if jsonb_typeof(v -> 'activo') <> 'boolean' or jsonb_typeof(v -> 'roles') <> 'array'
           or exists (select 1 from jsonb_array_elements_text(v -> 'roles') r where r not in ('superadmin', 'soporte', 'finanzas', 'contenido')) then
          raise exception 'Aviso % mal formado.', k;
        end if;
      end loop;
    else null;
  end case;
  update public.plataforma_config set valor = p_valor, updated_at = now() where clave = p_clave;
  perform private.auditar(s.user_id, s.nombre, 'edito_ajuste', 'ajuste', p_clave, p_clave, jsonb_build_object('antes', antes, 'despues', p_valor));
end $$;
