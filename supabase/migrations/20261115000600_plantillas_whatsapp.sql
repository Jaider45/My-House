-- Diseño «Admin SaaS» → Plantillas de WhatsApp: se crean en la consola, se mandan a revisión de Meta (API de
-- WhatsApp Business) y su estado vuelve por el webhook o al sincronizar. Las validaciones de forma viven en
-- src/lib/whatsapp/plantillas.ts; la base guarda y deja auditoría.

create table public.plantillas_whatsapp (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (nombre ~ '^[a-z][a-z0-9_]{0,100}$'),
  idioma         text not null default 'es' check (idioma ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  categoria      text not null default 'UTILITY' check (categoria in ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
  encabezado     text not null default '' check (char_length(encabezado) <= 60),
  cuerpo         text not null default '' check (char_length(cuerpo) <= 1024),
  ejemplos       text[] not null default '{}',
  pie            text not null default '' check (char_length(pie) <= 60),
  botones        jsonb not null default '[]' check (jsonb_typeof(botones) = 'array' and jsonb_array_length(botones) <= 3),
  estado         text not null default 'borrador' check (estado in ('borrador', 'en_revision', 'aprobada', 'rechazada', 'pausada')),
  meta_id        text,
  motivo_rechazo text,
  enviada_en     timestamptz,
  editada_por    text,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (nombre, idioma)
);
alter table public.plantillas_whatsapp enable row level security;
revoke all on public.plantillas_whatsapp from anon, authenticated;

create function public.consola_plantillas_whatsapp() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return (select coalesce(jsonb_agg(to_jsonb(p) order by p.estado = 'borrador' desc, p.nombre), '[]'::jsonb) from public.plantillas_whatsapp p);
end $$;

-- Guardar borrador (crear o editar). Una plantilla enviada o aprobada no se edita: Meta exige crear otra
-- (o editar en su panel); se puede duplicar con otro nombre.
create function public.consola_guardar_plantilla(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  nid uuid := nullif(p ->> 'id', '')::uuid;
  actual public.plantillas_whatsapp;
begin
  if nid is not null then
    select * into actual from public.plantillas_whatsapp where id = nid for update;
    if actual.id is null then
      raise exception 'Esa plantilla no existe.';
    end if;
    if actual.estado not in ('borrador', 'rechazada') then
      raise exception 'Ya está en Meta: para cambiarla, duplícala con otro nombre.';
    end if;
    update public.plantillas_whatsapp set nombre = p ->> 'nombre', idioma = coalesce(p ->> 'idioma', 'es'), categoria = p ->> 'categoria',
      encabezado = coalesce(p ->> 'encabezado', ''), cuerpo = coalesce(p ->> 'cuerpo', ''),
      ejemplos = coalesce(array(select jsonb_array_elements_text(p -> 'ejemplos')), '{}'), pie = coalesce(p ->> 'pie', ''),
      botones = coalesce(p -> 'botones', '[]'), estado = 'borrador', motivo_rechazo = null, editada_por = s.nombre, updated_at = now()
     where id = nid;
  else
    insert into public.plantillas_whatsapp (nombre, idioma, categoria, encabezado, cuerpo, ejemplos, pie, botones, editada_por)
    values (p ->> 'nombre', coalesce(p ->> 'idioma', 'es'), coalesce(p ->> 'categoria', 'UTILITY'), coalesce(p ->> 'encabezado', ''), coalesce(p ->> 'cuerpo', ''),
            coalesce(array(select jsonb_array_elements_text(p -> 'ejemplos')), '{}'), coalesce(p ->> 'pie', ''), coalesce(p -> 'botones', '[]'), s.nombre)
    returning id into nid;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_plantilla_whatsapp', 'plantilla', nid::text, p ->> 'nombre', '{}'::jsonb);
  return nid;
end $$;

-- Tras el POST a Meta (lo hace el servidor con el token de la integración).
create function public.consola_plantilla_enviada(p_id uuid, p_meta_id text, p_estado text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
begin
  update public.plantillas_whatsapp set meta_id = p_meta_id, estado = case when p_estado in ('aprobada', 'rechazada', 'en_revision', 'pausada') then p_estado else 'en_revision' end,
    enviada_en = now(), updated_at = now() where id = p_id;
  perform private.auditar(s.user_id, s.nombre, 'envio_plantilla_meta', 'plantilla', p_id::text, (select nombre from public.plantillas_whatsapp where id = p_id), jsonb_build_object('meta_id', p_meta_id));
end $$;

-- Estado que llega de Meta (sincronizar o webhook): por nombre e idioma. Devuelve si pasó a rechazada.
create function public.plantilla_estado_meta(p_nombre text, p_idioma text, p_estado text, p_motivo text, p_meta_id text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  antes text;
begin
  select estado into antes from public.plantillas_whatsapp where nombre = p_nombre and (idioma = p_idioma or p_idioma is null) limit 1;
  if antes is null then
    -- Creada en el panel de Meta: queda registrada para verla (y usarla) desde la consola.
    insert into public.plantillas_whatsapp (nombre, idioma, estado, meta_id, motivo_rechazo, editada_por)
    values (p_nombre, coalesce(p_idioma, 'es'), p_estado, p_meta_id, nullif(p_motivo, ''), 'Meta')
    on conflict (nombre, idioma) do nothing;
    return p_estado = 'rechazada';
  end if;
  update public.plantillas_whatsapp set estado = p_estado, motivo_rechazo = case when p_estado = 'rechazada' then nullif(p_motivo, '') end,
    meta_id = coalesce(p_meta_id, meta_id), updated_at = now()
   where nombre = p_nombre and (idioma = p_idioma or p_idioma is null) and estado <> 'borrador';
  return p_estado = 'rechazada' and antes <> 'rechazada';
end $$;

create function public.consola_plantilla_estado_meta(p_nombre text, p_idioma text, p_estado text, p_motivo text, p_meta_id text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.exigir_staff('contenido_app');
  return public.plantilla_estado_meta(p_nombre, p_idioma, p_estado, p_motivo, p_meta_id);
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['consola_plantillas_whatsapp()', 'consola_guardar_plantilla(jsonb)', 'consola_plantilla_enviada(uuid, text, text)',
                           'consola_plantilla_estado_meta(text, text, text, text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.plantilla_estado_meta(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.plantilla_estado_meta(text, text, text, text, text) to service_role;
