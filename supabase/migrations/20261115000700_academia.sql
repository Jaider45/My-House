-- Diseño «Admin SaaS» → Academia: rutas y lecciones en la base (el equipo las edita y publica desde la consola),
-- recomendaciones automáticas por situación del hogar, talleres en vivo con inscripción, calificaciones y el registro
-- de lecciones vistas para las métricas. El contenido inicial es el que estaba en el código (src/lib/academia/semilla.ts).

create table public.academia_rutas (
  slug        text primary key check (slug ~ '^[a-z][a-z0-9-]{1,40}$'),
  titulo      text not null check (char_length(btrim(titulo)) between 3 and 80),
  portada     text not null default '' check (char_length(portada) <= 60),
  descripcion text not null default '' check (char_length(descripcion) <= 240),
  tema        text not null default 'finanzas' check (tema in ('app', 'finanzas', 'ahorro', 'renta', 'deudas')),
  icono       text not null default 'resumen',
  color       text not null default 'monte' check (color in ('monte', 'teja', 'mar', 'arena')),
  orden       int not null default 100,
  publicada   boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table public.academia_lecciones (
  id         uuid primary key default gen_random_uuid(),
  ruta       text not null references public.academia_rutas on update cascade on delete cascade,
  slug       text not null check (slug ~ '^[a-z][a-z0-9-]{1,60}$'),
  titulo     text not null check (char_length(btrim(titulo)) between 3 and 120),
  minutos    int not null default 3 check (minutos between 1 and 60),
  orden      int not null default 100,
  bloques    jsonb not null default '[]' check (jsonb_typeof(bloques) = 'array'),
  publicada  boolean not null default false,
  borrador   jsonb,                       -- cambios sin publicar: {titulo, minutos, bloques}
  editada_por text,
  updated_at timestamptz not null default now(),
  unique (ruta, slug)
);
create index academia_lecciones_ruta_idx on public.academia_lecciones (ruta, orden);

alter table public.academia_rutas enable row level security;
alter table public.academia_lecciones enable row level security;
-- La app lee lo publicado (cualquiera con sesión); los borradores solo por las funciones de la consola.
create policy rutas_publicadas on public.academia_rutas for select to authenticated using (publicada);
create policy lecciones_publicadas on public.academia_lecciones for select to authenticated
  using (publicada and exists (select 1 from public.academia_rutas r where r.slug = ruta and r.publicada));
revoke insert, update, delete, truncate on public.academia_rutas, public.academia_lecciones from anon, authenticated;
revoke all on public.academia_rutas, public.academia_lecciones from anon;

-- Lecciones vistas y calificaciones (para las métricas; el avance de la persona también vive en user_metadata).
create table public.academia_vistas (
  user_id uuid not null references auth.users on delete cascade,
  clave   text not null,
  creada  timestamptz not null default now(),
  primary key (user_id, clave)
);
create table public.academia_calificaciones (
  user_id  uuid not null references auth.users on delete cascade,
  clave    text not null,
  estrellas int not null check (estrellas between 1 and 5),
  creada   timestamptz not null default now(),
  primary key (user_id, clave)
);
alter table public.academia_vistas enable row level security;
alter table public.academia_calificaciones enable row level security;
revoke all on public.academia_vistas, public.academia_calificaciones from anon, authenticated;

create function public.academia_vista(p_clave text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.academia_vistas (user_id, clave) select auth.uid(), left(p_clave, 120) where auth.uid() is not null
  on conflict do nothing
$$;

create function public.academia_calificar(p_clave text, p_estrellas int) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.academia_calificaciones (user_id, clave, estrellas) select auth.uid(), left(p_clave, 120), p_estrellas
   where auth.uid() is not null and p_estrellas between 1 and 5
  on conflict (user_id, clave) do update set estrellas = excluded.estrellas, creada = now()
$$;

-- ───────────────────────── recomendaciones ─────────────────────────

create table public.academia_recomendaciones (
  id        uuid primary key default gen_random_uuid(),
  condicion text not null check (condicion in ('presupuesto_excedido', 'tope_dian', 'fondo_atrasado', 'sin_fondo', 'varias_deudas',
                                                'un_miembro_14d', 'sin_registro_7d', 'siempre')),
  ruta      text not null references public.academia_rutas on update cascade on delete cascade,
  leccion   text,                          -- slug; vacío = la ruta
  lugares   text[] not null default '{academia}',
  activa    boolean not null default true,
  orden     int not null default 100,
  clics     int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.academia_recomendaciones enable row level security;
revoke all on public.academia_recomendaciones from anon, authenticated;

create function private.condicion_academia(p_cond text, p_hogar uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_mes date := date_trunc('month', v_hoy)::date;
begin
  return case p_cond
    when 'siempre' then true
    when 'presupuesto_excedido' then exists (
      select 1 from public.budgets_goals b
       where b.household_id = p_hogar and b.tipo = 'presupuesto' and b.category_id is not null and b.monto > 0
         and (b.mes is null or b.mes = v_mes)
         and (select coalesce(sum(t.monto), 0) from public.transactions t join public.categories c on c.id = t.category_id
               where t.household_id = p_hogar and t.tipo = 'gasto' and t.estado = 'confirmado' and t.fecha >= v_mes
                 and (c.id = b.category_id or c.padre_id = b.category_id)) > b.monto)
    when 'tope_dian' then exists (
      select 1 from public.avisos_enviados a where a.household_id = p_hogar and a.clave like 'dian:' || extract(year from v_hoy)::int || ':%')
    when 'sin_fondo' then not exists (select 1 from public.budgets_goals b where b.household_id = p_hogar and b.tipo = 'meta' and b.es_emergencia)
    when 'fondo_atrasado' then exists (
      select 1 from public.budgets_goals b
       where b.household_id = p_hogar and b.tipo = 'meta' and b.es_emergencia and b.monto > 0 and b.fecha_objetivo is not null and b.fecha_objetivo > b.created_at::date
         and (coalesce(b.ahorrado_inicial, 0) + (select coalesce(sum(t.monto), 0) from public.transactions t where t.household_id = p_hogar and t.goal_id = b.id and t.estado = 'confirmado'))::numeric / b.monto
             < least(1, (v_hoy - b.created_at::date)::numeric / (b.fecha_objetivo - b.created_at::date)))
    when 'varias_deudas' then (select count(*) from public.debts d where d.household_id = p_hogar and not d.archivada) > 1
    when 'un_miembro_14d' then (select h.created_at < now() - interval '14 days' from public.households h where h.id = p_hogar)
      and (select count(*) from public.members m where m.household_id = p_hogar and m.user_id is not null) = 1
    when 'sin_registro_7d' then not exists (
      select 1 from public.transactions t where t.household_id = p_hogar and t.origen <> 'recurrente' and t.created_at > now() - interval '7 days')
    else false end;
end $$;

-- Recomendaciones del lugar para el hogar activo (la lección o ruta, ya publicada; las lecciones vistas no se repiten).
create function public.mis_recomendaciones(p_lugar text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  h uuid := private.hogar_activo_de(auth.uid());
begin
  if h is null then
    return '[]'::jsonb;
  end if;
  return (select coalesce(jsonb_agg(x.j order by x.orden), '[]'::jsonb) from (
    select r.orden, jsonb_build_object('id', r.id, 'condicion', r.condicion, 'ruta', r.ruta, 'ruta_titulo', ru.titulo, 'icono', ru.icono,
             'leccion', r.leccion, 'leccion_titulo', l.titulo, 'minutos', coalesce(l.minutos, (select sum(minutos) from public.academia_lecciones z where z.ruta = r.ruta and z.publicada))) j
      from public.academia_recomendaciones r
      join public.academia_rutas ru on ru.slug = r.ruta and ru.publicada
      left join public.academia_lecciones l on l.ruta = r.ruta and l.slug = r.leccion and l.publicada
     where r.activa and p_lugar = any (r.lugares) and (r.leccion is null or l.id is not null)
       and not exists (select 1 from public.academia_vistas v where v.user_id = auth.uid() and v.clave = r.ruta || '/' || coalesce(r.leccion, ''))
       and private.condicion_academia(r.condicion, h)
     order by r.orden limit 3) x);
end $$;

create function public.clic_recomendacion(p_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.academia_recomendaciones;
begin
  update public.academia_recomendaciones set clics = clics + 1 where id = p_id and activa returning * into r;
  if r.id is null or auth.uid() is null then
    return null;
  end if;
  return '/academia/' || r.ruta || coalesce('/' || r.leccion, '');
end $$;

-- ───────────────────────── talleres en vivo ─────────────────────────

create table public.academia_talleres (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(btrim(titulo)) between 3 and 100),
  descripcion text not null default '' check (char_length(descripcion) <= 500),
  fecha       timestamptz not null,
  enlace      text check (enlace is null or enlace ~ '^https://'),   -- Zoom, Meet…: llega a quien se inscribe
  cupos       int not null default 100 check (cupos between 1 and 10000),
  publicado   boolean not null default false,
  created_at  timestamptz not null default now()
);
create table public.academia_inscripciones (
  taller_id uuid not null references public.academia_talleres on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  creada    timestamptz not null default now(),
  primary key (taller_id, user_id)
);
alter table public.academia_talleres enable row level security;
alter table public.academia_inscripciones enable row level security;
revoke all on public.academia_talleres, public.academia_inscripciones from anon, authenticated;

-- Talleres publicados y por venir, con cupos e inscripción propia (el enlace solo para quien se inscribió).
create function public.talleres_academia() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'descripcion', t.descripcion, 'fecha', t.fecha, 'cupos', t.cupos,
           'inscritos', (select count(*) from public.academia_inscripciones i where i.taller_id = t.id),
           'inscrito', exists (select 1 from public.academia_inscripciones i where i.taller_id = t.id and i.user_id = auth.uid()),
           'enlace', case when exists (select 1 from public.academia_inscripciones i where i.taller_id = t.id and i.user_id = auth.uid()) then t.enlace end)
           order by t.fecha), '[]'::jsonb)
    from public.academia_talleres t where t.publicado and t.fecha > now() - interval '2 hours' and auth.uid() is not null
$$;

create function public.inscribir_taller(p_id uuid, p_inscribir boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  t public.academia_talleres;
begin
  select * into t from public.academia_talleres where id = p_id and publicado and fecha > now() for update;
  if t.id is null or auth.uid() is null then
    raise exception 'Ese taller ya no está disponible.';
  end if;
  if not p_inscribir then
    delete from public.academia_inscripciones where taller_id = p_id and user_id = auth.uid();
    return null;
  end if;
  if (select count(*) from public.academia_inscripciones where taller_id = p_id) >= t.cupos then
    raise exception 'Ya no quedan cupos.';
  end if;
  insert into public.academia_inscripciones (taller_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('titulo', t.titulo, 'fecha', t.fecha, 'enlace', t.enlace);
end $$;

-- ───────────────────────── consola ─────────────────────────

create function public.consola_academia() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'lecciones', (select count(*) from public.academia_lecciones l join public.academia_rutas r on r.slug = l.ruta where l.publicada and r.publicada),
      'rutas', (select count(*) from public.academia_rutas where publicada),
      'aprenden_30d', (select count(distinct user_id) from public.academia_vistas where creada > now() - interval '30 days'),
      'activos_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
      'calificacion', (select round(avg(estrellas)::numeric, 1) from public.academia_calificaciones),
      'opiniones', (select count(*) from public.academia_calificaciones),
      'finalizacion', (select round(100.0 * avg(case when x.vistas >= x.total then 1 else 0 end))
                         from (select v.user_id, r.slug, count(*) vistas,
                                      (select count(*) from public.academia_lecciones l where l.ruta = r.slug and l.publicada) total
                                 from public.academia_vistas v join public.academia_rutas r on v.clave like r.slug || '/%'
                                group by v.user_id, r.slug) x where x.total > 0)),
    'rutas', (select coalesce(jsonb_agg(jsonb_build_object(
        'slug', r.slug, 'titulo', r.titulo, 'portada', r.portada, 'descripcion', r.descripcion, 'tema', r.tema, 'icono', r.icono,
        'color', r.color, 'orden', r.orden, 'publicada', r.publicada,
        'empezaron', (select count(distinct v.user_id) from public.academia_vistas v where v.clave like r.slug || '/%'),
        'lecciones', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', l.id, 'slug', l.slug, 'titulo', l.titulo, 'minutos', l.minutos, 'orden', l.orden, 'bloques', l.bloques,
            'publicada', l.publicada, 'borrador', l.borrador, 'editada_por', l.editada_por, 'updated_at', l.updated_at,
            'vistas', (select count(*) from public.academia_vistas v where v.clave = r.slug || '/' || l.slug),
            'calificacion', (select round(avg(c.estrellas)::numeric, 1) from public.academia_calificaciones c where c.clave = r.slug || '/' || l.slug))
            order by l.orden, l.slug), '[]'::jsonb) from public.academia_lecciones l where l.ruta = r.slug))
        order by r.orden, r.titulo), '[]'::jsonb) from public.academia_rutas r),
    'recomendaciones', (select coalesce(jsonb_agg(to_jsonb(x) order by x.orden, x.created_at), '[]'::jsonb) from public.academia_recomendaciones x),
    'talleres', (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('inscritos', (select count(*) from public.academia_inscripciones i where i.taller_id = t.id))
                   order by t.fecha desc), '[]'::jsonb) from public.academia_talleres t));
end $$;

create function public.consola_guardar_ruta(p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  previo text := nullif(p ->> 'slug_previo', '');
begin
  if previo is null then
    insert into public.academia_rutas (slug, titulo, portada, descripcion, tema, icono, color, orden, publicada)
    values (p ->> 'slug', btrim(p ->> 'titulo'), coalesce(p ->> 'portada', ''), coalesce(p ->> 'descripcion', ''), coalesce(p ->> 'tema', 'finanzas'),
            coalesce(p ->> 'icono', 'resumen'), coalesce(p ->> 'color', 'monte'), coalesce((p ->> 'orden')::int, 100), coalesce((p ->> 'publicada')::boolean, false));
  else
    update public.academia_rutas set slug = p ->> 'slug', titulo = btrim(p ->> 'titulo'), portada = coalesce(p ->> 'portada', ''),
      descripcion = coalesce(p ->> 'descripcion', ''), tema = coalesce(p ->> 'tema', 'finanzas'), icono = coalesce(p ->> 'icono', 'resumen'),
      color = coalesce(p ->> 'color', 'monte'), orden = coalesce((p ->> 'orden')::int, orden), publicada = coalesce((p ->> 'publicada')::boolean, false), updated_at = now()
     where slug = previo;
    if not found then
      raise exception 'Esa ruta no existe.';
    end if;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_ruta_academia', 'academia', p ->> 'slug', btrim(p ->> 'titulo'), '{}'::jsonb);
end $$;

-- Lección: crear (queda en borrador sin publicar) o guardar cambios como borrador; publicar los aplica.
create function public.consola_guardar_leccion(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  nid uuid := nullif(p ->> 'id', '')::uuid;
  borrador jsonb := jsonb_build_object('titulo', btrim(p ->> 'titulo'), 'minutos', coalesce((p ->> 'minutos')::int, 3), 'bloques', coalesce(p -> 'bloques', '[]'));
begin
  if nid is null then
    insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, borrador, editada_por)
    values (p ->> 'ruta', p ->> 'slug', btrim(p ->> 'titulo'), coalesce((p ->> 'minutos')::int, 3),
            coalesce((select max(orden) + 1 from public.academia_lecciones where ruta = p ->> 'ruta'), 1), '[]', false, borrador, s.nombre)
    returning id into nid;
  else
    update public.academia_lecciones set borrador = borrador, editada_por = s.nombre, updated_at = now() where id = nid;
    if not found then
      raise exception 'Esa lección no existe.';
    end if;
  end if;
  return nid;
end $$;

create function public.consola_publicar_leccion(p_id uuid, p_publicar boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  l public.academia_lecciones;
begin
  select * into l from public.academia_lecciones where id = p_id for update;
  if l.id is null then
    raise exception 'Esa lección no existe.';
  end if;
  if p_publicar then
    update public.academia_lecciones set
      titulo = coalesce(l.borrador ->> 'titulo', titulo), minutos = coalesce((l.borrador ->> 'minutos')::int, minutos),
      bloques = coalesce(l.borrador -> 'bloques', bloques), borrador = null, publicada = true, updated_at = now()
     where id = p_id;
  else
    update public.academia_lecciones set publicada = false, updated_at = now() where id = p_id;
  end if;
  perform private.auditar(s.user_id, s.nombre, case when p_publicar then 'publico_leccion' else 'despublico_leccion' end, 'academia', l.ruta || '/' || l.slug, l.titulo, '{}'::jsonb);
end $$;

create function public.consola_ordenar_lecciones(p_ruta text, p_ids uuid[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.exigir_staff('contenido_app');
  update public.academia_lecciones l set orden = x.n, updated_at = now()
    from unnest(p_ids) with ordinality as x(id, n) where l.id = x.id and l.ruta = p_ruta;
end $$;

create function public.consola_guardar_recomendacion(p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  nid uuid := nullif(p ->> 'id', '')::uuid;
  lugares text[] := coalesce(array(select jsonb_array_elements_text(p -> 'lugares')), '{academia}');
begin
  if exists (select 1 from unnest(lugares) x where x not in ('academia', 'inicio', 'presupuesto', 'renta', 'metas', 'pagos')) then
    raise exception 'Lugar no válido.';
  end if;
  if coalesce((p ->> 'borrar')::boolean, false) then
    delete from public.academia_recomendaciones where id = nid;
  elsif nid is null then
    insert into public.academia_recomendaciones (condicion, ruta, leccion, lugares, activa, orden)
    values (p ->> 'condicion', p ->> 'ruta', nullif(p ->> 'leccion', ''), lugares, coalesce((p ->> 'activa')::boolean, true), coalesce((p ->> 'orden')::int, 100));
  else
    update public.academia_recomendaciones set condicion = p ->> 'condicion', ruta = p ->> 'ruta', leccion = nullif(p ->> 'leccion', ''), lugares = lugares,
      activa = coalesce((p ->> 'activa')::boolean, true), orden = coalesce((p ->> 'orden')::int, orden)
     where id = nid;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_recomendacion_academia', 'academia', coalesce(nid::text, p ->> 'condicion'), p ->> 'condicion', '{}'::jsonb);
end $$;

create function public.consola_guardar_taller(p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  nid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if nid is null then
    insert into public.academia_talleres (titulo, descripcion, fecha, enlace, cupos, publicado)
    values (btrim(p ->> 'titulo'), coalesce(p ->> 'descripcion', ''), (p ->> 'fecha')::timestamptz, nullif(btrim(coalesce(p ->> 'enlace', '')), ''),
            coalesce((p ->> 'cupos')::int, 100), coalesce((p ->> 'publicado')::boolean, false));
  else
    update public.academia_talleres set titulo = btrim(p ->> 'titulo'), descripcion = coalesce(p ->> 'descripcion', ''), fecha = (p ->> 'fecha')::timestamptz,
      enlace = nullif(btrim(coalesce(p ->> 'enlace', '')), ''), cupos = coalesce((p ->> 'cupos')::int, 100), publicado = coalesce((p ->> 'publicado')::boolean, false)
     where id = nid;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_taller', 'academia', coalesce(nid::text, ''), btrim(p ->> 'titulo'), '{}'::jsonb);
end $$;

-- ───────────────────────── contenido inicial ─────────────────────────
insert into public.academia_rutas (slug, titulo, portada, descripcion, tema, icono, color, orden, publicada) values ('empieza', 'Empieza con My House', 'Empieza con My House', 'Registrar, pagos fijos, presupuesto y asistente: lo esencial para arrancar bien.', 'app', 'resumen', 'monte', 1, true);
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('empieza', 'registrar', 'Registra un gasto en 10 segundos', 2, 1, $j$[{"p": "Lo que no se registra no existe. La buena noticia: registrar un gasto en My House toma menos de lo que tardas en guardar el recibo en la billetera."}, {"h2": "Los tres datos que importan"}, {"opciones": [{"titulo": "¿Cuánto?", "texto": "El monto, sin puntos ni signos: My House los pone por ti."}, {"titulo": "¿En qué?", "texto": "Escríbelo como se lo dirías a alguien: «droguería», «mercado», «Terpel»."}, {"titulo": "¿De dónde?", "texto": "La cuenta o tarjeta. Recordamos la última que usaste en este celular."}]}, {"p": "La segunda vez que escribas el mismo concepto, My House ya sabe en qué categoría va y de qué cuenta suele salir. Si se equivoca, toca «Cambiar»."}, {"p": "¿Lo vas a pagar después? Marca «Lo pago después»: queda pendiente en Movimientos hasta que lo marques como pagado. Y si estás sin señal, el registro se guarda en el celular y se envía solo cuando vuelva."}, {"guia": {"id": "gasto", "texto": "Te muestro dónde tocar, paso a paso, y registras tu primer gasto de verdad."}}, {"quiz": {"pregunta": "Registraste «Terpel» la semana pasada en Transporte. ¿Qué pasa hoy si vuelves a escribir «Terpel»?", "opciones": ["Tengo que elegir la categoría otra vez", "My House la sugiere solo", "No se puede repetir un concepto"], "correcta": 1, "bien": "Exacto. Lo que registras enseña a My House; tú solo confirmas.", "mal": "Casi. My House recuerda el concepto y te sugiere la categoría y la cuenta."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('empieza', 'pagos-fijos', 'Cómo organizar los pagos fijos para que nada se venza', 3, 2, $j$[{"p": "Arriendo, administración, servicios, colegio, planes de celular, cuotas: los pagos fijos son la base del costo de vida. Cargarlos una vez te ahorra registrarlos cada mes y evita los recargos por mora."}, {"h2": "Cómo funcionan en My House"}, {"p": "Creas el pago una sola vez con su monto, la fecha de un pago y cada cuánto se repite. Siete días antes de cada fecha aparece en Movimientos como pendiente; cuando lo pagas, lo marcas y listo."}, {"opciones": [{"titulo": "Pendiente", "texto": "Ya está programado y aún no vence. Lo ves en el calendario de Pagos fijos."}, {"titulo": "Vencido", "texto": "Pasó la fecha y no lo marcaste. Sale en rojo y te avisamos por correo si lo pediste."}, {"titulo": "Pagado", "texto": "Lo marcaste como pagado: ya cuenta como gasto del mes."}]}, {"p": "Un truco: pon la fecha de pago unos días antes de la fecha límite real. Así tienes margen si el sueldo llega tarde."}, {"p": "¿Es la cuota de un crédito? Regístralo en Deudas: además de la cuota mensual verás cuánto te falta y cuándo terminas."}, {"guia": {"id": "pago_fijo", "texto": "Créalo conmigo: te ilumino cada campo del formulario."}}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Revisa el calendario del mes y marca lo que ya pagaste.", "href": "/recurrentes", "boton": "Ver pagos fijos"}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('empieza', 'presupuesto', 'Arma tu presupuesto en 5 minutos', 3, 3, $j$[{"p": "En My House el presupuesto tiene dos partes: los pagos fijos, que ya cuentan solos, y el gasto variable que planeas en cada categoría: mercado, transporte, salidas."}, {"p": "No tienes que adivinar: al agregar un presupuesto te mostramos el promedio de tus últimos tres meses y dos opciones, un poco más o ahorrar el 10 %."}, {"h2": "El semáforo"}, {"opciones": [{"titulo": "En rango", "texto": "Lo gastado y el pronóstico están dentro de lo planeado."}, {"titulo": "Atento", "texto": "A este ritmo te pasarás antes de que acabe el mes."}, {"titulo": "Excedido", "texto": "Ya gastaste más de lo planeado en esa categoría."}]}, {"guia": {"id": "presupuesto", "texto": "Te acompaño a poner tu primer presupuesto de gasto variable."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('empieza', 'asistente', 'El asistente de comprobantes', 2, 4, $j$[{"p": "Toma una foto de la factura, sube el PDF o una captura de Nequi o Daviplata. El asistente lee el comercio, la fecha y el monto, elige la categoría y lo registra."}, {"p": "Si el pago ya estaba (por ejemplo, un pago fijo que marcaste), no lo duplica: adjunta el archivo como soporte. Y si no está seguro de algo, te pregunta en Movimientos → Por revisar."}, {"p": "Cada comprobante queda guardado como soporte. En abril, cuando el contador pida los certificados de salud o las facturas del negocio, ya los tienes."}, {"guia": {"id": "revisar", "texto": "Te muestro cómo resolver lo que el asistente dejó por revisar."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('empieza', 'invitar', 'Registren los dos y vean lo mismo', 2, 5, $j$[{"p": "Las finanzas de la casa son de todos los que la sostienen. Invita a tu pareja para que registre desde su celular: los dos ven los mismos movimientos, el mismo presupuesto y los mismos pagos."}, {"opciones": [{"titulo": "Pareja o familiar", "texto": "Registra, edita y marca pagos."}, {"titulo": "Administrador", "texto": "Además invita, quita personas y cambia la configuración."}, {"titulo": "Contador", "texto": "Solo mira: movimientos, Renta DIAN y soportes."}]}, {"guia": {"id": "invitar", "texto": "Te llevo a crear la invitación y compartir el enlace por WhatsApp."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_rutas (slug, titulo, portada, descripcion, tema, icono, color, orden, publicada) values ('finanzas', 'Finanzas del hogar desde cero', 'Finanzas del hogar desde cero', 'Número mínimo, gastos fijos y variables, y cómo saber si te alcanza.', 'finanzas', 'casa', 'teja', 2, true);
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('finanzas', 'numero-minimo', '¿Qué es el número mínimo del hogar?', 3, 1, $j$[{"p": "El número mínimo es lo que la casa necesita cada mes para funcionar, pase lo que pase: los pagos fijos esenciales, los gastos esenciales del día a día y una cuota para imprevistos."}, {"p": "Es tu cifra más importante porque responde la pregunta que de verdad preocupa: si mañana entrara menos plata, ¿cuánto necesitamos sí o sí?"}, {"h2": "Cómo lo calcula My House"}, {"opciones": [{"titulo": "Fijos esenciales", "texto": "Arriendo o cuota de vivienda, servicios, colegio, salud, cuotas de deudas."}, {"titulo": "Variables esenciales", "texto": "Mercado y transporte: lo presupuestado o lo que sueles gastar, lo que sea mayor."}, {"titulo": "Imprevistos", "texto": "Un porcentaje sobre lo anterior (10 % por defecto) para lo que siempre aparece."}]}, {"p": "Lo que no es esencial (salidas, ropa, suscripciones) queda por fuera. No porque esté mal gastar en eso, sino porque es lo primero que se puede ajustar si toca."}, {"p": "Úsalo para dos cosas: saber cuánto debe tener tu fondo de emergencia (de 3 a 6 veces el número mínimo) y para ver si tus ingresos lo cubren con holgura."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Mira tu número mínimo y cuántas veces lo cubren tus ingresos.", "href": "/", "boton": "Ver mi número mínimo"}}, {"quiz": {"pregunta": "¿Cuál de estos gastos entra en el número mínimo?", "opciones": ["La suscripción de streaming", "El mercado del mes", "Las salidas a comer"], "correcta": 1, "bien": "Exacto. El mercado es esencial; lo demás se puede ajustar si toca.", "mal": "Casi. El número mínimo solo cuenta lo esencial: aquí, el mercado."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('finanzas', 'fijos-y-variables', 'Gastos fijos y variables: dónde está el margen', 3, 2, $j$[{"p": "Los gastos fijos se repiten con el mismo monto y casi en la misma fecha: arriendo, administración, colegio, planes. Los variables cambian cada mes: mercado, gasolina, domicilios, salidas."}, {"p": "Los fijos se deciden una vez (cambiar de plan de celular, renegociar el arriendo) y el ahorro dura todos los meses. Los variables se deciden todos los días, y ahí es donde se escapa la plata sin darte cuenta."}, {"h2": "Una regla práctica"}, {"p": "Si tus fijos pasan del 60 % de lo que entra, el mes se vuelve frágil: cualquier imprevisto descuadra. Revisa primero los fijos grandes; luego ponle presupuesto a dos o tres variables, no a todas."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "En Presupuesto ves cuánto son fijos y cuánto variable en cada categoría.", "href": "/presupuesto", "boton": "Ver presupuesto"}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('finanzas', 'presupuesto-que-se-cumple', 'Cómo armar un presupuesto que sí se cumple', 4, 3, $j$[{"p": "Un presupuesto que no se cumple casi siempre falla por lo mismo: se armó con lo que quisiéramos gastar y no con lo que de verdad gastamos."}, {"h2": "Tres pasos"}, {"opciones": [{"titulo": "1. Parte de lo real", "texto": "Usa el promedio de los últimos tres meses. My House te lo muestra al agregar cada categoría."}, {"titulo": "2. Ajusta pocas cosas", "texto": "Elige dos o tres categorías para recortar. Si cambias todo a la vez, no se sostiene."}, {"titulo": "3. Mira el ritmo", "texto": "El semáforo te avisa a mitad de mes si vas rápido, cuando aún hay tiempo de frenar."}]}, {"p": "El amarillo no es un regaño: es información. Si a día 15 una categoría ya va en amarillo, puedes frenar o mover plata de otra. El rojo, en cambio, ya pasó: úsalo para planear mejor el mes siguiente."}, {"guia": {"id": "presupuesto", "texto": "Pon tu primer presupuesto con la guía."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('finanzas', 'cuando-te-pasas', 'Qué hacer cuando una categoría se pasa', 3, 4, $j$[{"p": "Pasarse en una categoría le pasa a todo el mundo. Lo importante es qué haces con ese dato."}, {"opciones": [{"titulo": "Fue algo puntual", "texto": "Un regalo, un daño en la casa. No cambies el presupuesto: anótalo y sigue."}, {"titulo": "Pasa cada mes", "texto": "Entonces el presupuesto está mal. Súbelo y baja otra categoría para compensar."}, {"titulo": "Te sorprendió", "texto": "Revisa los movimientos de esa categoría: a veces son domicilios pequeños que suman mucho."}]}, {"p": "Para salidas y restaurantes funciona bien decidir el número de salidas del mes, no el monto: «cuatro salidas» es más fácil de cumplir que «$450.000»."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Mira qué categorías van en amarillo o rojo este mes.", "href": "/presupuesto", "boton": "Ver el semáforo"}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_rutas (slug, titulo, portada, descripcion, tema, icono, color, orden, publicada) values ('pareja', 'Presupuesto en pareja', 'Presupuesto en pareja', 'Cómo repartir los gastos, decidir juntos y no pelear por plata.', 'finanzas', 'familia', 'mar', 3, true);
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('pareja', 'numeros-sobre-la-mesa', 'Pongan sus números sobre la mesa', 3, 1, $j$[{"p": "La plata es uno de los temas que más discusiones genera en una pareja, y casi nunca por la plata en sí: es por no saber. Quién gana cuánto, quién paga qué, cuánto cuesta la casa."}, {"p": "El primer paso es aburrido pero poderoso: que los dos vean los mismos números. Ingresos, pagos fijos, deudas y el número mínimo del hogar."}, {"p": "No se trata de vigilarse. Se trata de que las decisiones (cambiar de carro, irse de vacaciones, cambiar de colegio) se tomen con la misma información."}, {"guia": {"id": "invitar", "texto": "Invita a tu pareja para que registre y vea lo mismo que tú."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('pareja', 'como-repartir', 'Cómo repartir los gastos de la casa', 5, 2, $j$[{"p": "No hay una sola forma correcta de repartir los gastos. Lo que funciona es que los dos sepan cuál eligieron y por qué. Cuando no se habla, uno termina pagando de más y el otro sin saber cuánto cuesta la casa."}, {"h2": "Las tres formas más usadas"}, {"opciones": [{"titulo": "Mitad y mitad", "texto": "Cada uno pone lo mismo. Es simple, pero pesa más para quien gana menos."}, {"titulo": "Proporcional", "texto": "Cada uno pone según lo que gana. Si uno gana el 65 % de los ingresos, pone el 65 % de los gastos."}, {"titulo": "Fondo común", "texto": "Todo entra a una sola bolsa y de ahí se paga todo. Requiere mucha confianza y orden."}]}, {"p": "Un ejemplo: si una persona gana $7.250.000 y la otra $4.600.000, el proporcional sería 61 % y 39 %. Sobre un número mínimo de $9.700.000, la primera pondría unos $5.917.000 y la segunda unos $3.783.000."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Con el número mínimo del hogar a la vista es más fácil calcular la parte de cada uno.", "href": "/", "boton": "Ver el número mínimo"}}, {"quiz": {"pregunta": "Si los dos ganan distinto y quieren que el esfuerzo sea parejo, ¿cuál forma conviene?", "opciones": ["Mitad y mitad", "Proporcional", "Fondo común"], "correcta": 1, "bien": "Exacto. El proporcional reparte según lo que gana cada uno.", "mal": "Casi. La que reparte según lo que gana cada uno es la proporcional."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('pareja', 'reunion-mensual', 'Una reunión de plata al mes', 3, 3, $j$[{"p": "Quince minutos al mes, el mismo día (por ejemplo, el primer domingo), con My House abierto. Con eso se evitan la mayoría de las sorpresas."}, {"opciones": [{"titulo": "Cómo cerró el mes", "texto": "¿Ahorramos lo que esperábamos? ¿Qué categoría se pasó?"}, {"titulo": "Qué viene", "texto": "Pagos grandes del mes siguiente: matrícula, SOAT, impuestos, cumpleaños."}, {"titulo": "Una decisión", "texto": "Solo una: subir el aporte a una meta, recortar algo, pagar una deuda antes."}]}, {"p": "Reglas de la reunión: nada de reproches por gastos pasados y nada de decisiones grandes sin dormir sobre ellas."}]$j$::jsonb, true, 'Sistema');
insert into public.academia_rutas (slug, titulo, portada, descripcion, tema, icono, color, orden, publicada) values ('ahorro', 'Ahorro y fondo de emergencia', 'Fondo de emergencia', 'Cuánto necesitas, dónde guardarlo y cómo llegar sin sufrir.', 'ahorro', 'ahorro', 'arena', 4, true);
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('ahorro', 'cuanto-fondo', '¿Cuánto debe tener tu fondo de emergencia?', 4, 1, $j$[{"p": "Un fondo de emergencia es plata guardada para vivir unos meses sin ingresos: si se pierde un empleo, si hay una enfermedad, si el negocio tiene un mal trimestre."}, {"h2": "¿Cuántos meses?"}, {"opciones": [{"titulo": "3 meses", "texto": "Si en la casa hay dos ingresos estables y de empleo formal."}, {"titulo": "6 meses", "texto": "Si hay un solo ingreso, o si es independiente o variable."}, {"titulo": "Más", "texto": "Si hay personas a cargo con necesidades de salud, o el sector es inestable."}]}, {"p": "La base no son tus gastos totales sino el número mínimo del hogar: en una emergencia recortas lo no esencial. Por eso en My House el fondo se mide en meses del número mínimo."}, {"p": "No tiene que estar completo mañana. Lo importante es que exista y crezca cada mes, aunque sea poco."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Crea la meta «Fondo de emergencia» y te decimos cuánto apartar al mes.", "href": "/metas", "boton": "Ir a Metas"}}, {"guia": {"id": "meta", "texto": "Crea tu fondo de emergencia con la guía."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('ahorro', 'donde-guardarlo', 'Dónde guardar el fondo', 3, 2, $j$[{"p": "El fondo de emergencia tiene que cumplir tres cosas: que no pierda valor, que lo puedas sacar en pocos días y que no esté tan a la mano que te lo gastes."}, {"opciones": [{"titulo": "Cuenta de ahorros aparte", "texto": "Distinta de la del día a día. Fácil, pero renta poco."}, {"titulo": "Cuentas o bolsillos de alto rendimiento", "texto": "Varias entidades pagan más intereses con retiro inmediato. Compara la tasa efectiva anual."}, {"titulo": "CDT corto", "texto": "Para la parte que no necesitarías en el primer mes. Escalónalos para que venzan en fechas distintas."}]}, {"p": "Evita las inversiones que pueden bajar de valor (acciones, criptomonedas) para esta plata: justo cuando la necesites puede valer menos."}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('ahorro', 'subir-el-aporte', 'Cómo subir el aporte sin sentirlo', 3, 3, $j$[{"p": "La forma más fácil de ahorrar es que el ahorro salga primero, el día que llega el sueldo, como un pago fijo más."}, {"opciones": [{"titulo": "Ahorro automático", "texto": "Crea un pago fijo a la meta el día de pago. Lo que no ves, no lo gastas."}, {"titulo": "Sube con cada aumento", "texto": "Cuando te suban el sueldo, sube el aporte la mitad del aumento."}, {"titulo": "Plata extra", "texto": "Primas, bonos y devoluciones: una parte fija va directo a la meta."}]}, {"p": "Si la meta va atrasada, My House te dice cuánto subir el aporte para llegar a tiempo. A veces son $50.000 al mes."}]$j$::jsonb, true, 'Sistema');
insert into public.academia_rutas (slug, titulo, portada, descripcion, tema, icono, color, orden, publicada) values ('renta', 'Renta para personas naturales', 'Renta sin enredos', 'Topes, UVT, deducciones y qué soportes guardar desde enero.', 'renta', 'declaracion-renta', 'monte', 5, true);
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('renta', 'quien-declara', '¿Quién debe declarar renta?', 4, 1, $j$[{"p": "En Colombia, una persona natural debe declarar renta si en el año superó cualquiera de los topes que fija la DIAN. Basta con uno."}, {"h2": "Los topes, en UVT"}, {"opciones": [{"titulo": "Ingresos brutos", "texto": "1.400 UVT en el año: salario, honorarios, arriendos, ventas."}, {"titulo": "Patrimonio bruto", "texto": "4.500 UVT al 31 de diciembre: cuentas, inmuebles, carro, inversiones."}, {"titulo": "Consumos y movimientos", "texto": "1.400 UVT en consumos con tarjeta, en compras totales o en consignaciones e inversiones."}]}, {"p": "La UVT (Unidad de Valor Tributario) cambia cada año. En Renta DIAN ves su valor y los topes ya convertidos a pesos."}, {"p": "Los topes son por persona, no por hogar. Por eso My House lleva un semáforo para cada adulto."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Mira el semáforo de cada persona del hogar.", "href": "/impuestos", "boton": "Ver Renta DIAN"}}, {"quiz": {"pregunta": "Camila ganó menos del tope de ingresos, pero sus consumos con tarjeta lo superaron. ¿Debe declarar?", "opciones": ["No, solo cuentan los ingresos", "Sí, basta con superar un tope", "Solo si tiene carro"], "correcta": 1, "bien": "Exacto. Superar cualquiera de los topes obliga a declarar.", "mal": "Casi. Basta con superar uno de los topes, sea cual sea."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('renta', 'soportes', 'Los soportes que debes guardar desde enero', 4, 2, $j$[{"p": "La declaración se hace entre agosto y octubre, pero los soportes se juntan durante todo el año. Buscarlos en agosto es la forma más segura de perder deducciones."}, {"opciones": [{"titulo": "Certificado de ingresos y retenciones", "texto": "Lo entrega la empresa en marzo. Si tienes varios empleadores, uno de cada uno."}, {"titulo": "Salud y pensión", "texto": "Certificados de medicina prepagada, seguros de salud y aportes voluntarios a pensión o AFC."}, {"titulo": "Bancos", "texto": "Certificados de saldos al 31 de diciembre, intereses y el 4 × 1.000 pagado."}]}, {"p": "Si tienes negocio o eres independiente, guarda también las facturas de los costos. En My House marca esos gastos como «Negocio» y súbelos con el asistente: quedan como soporte."}, {"p": "Para dependientes (hijos, padres a cargo) guarda el registro civil o el soporte de la dependencia."}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('renta', 'deducciones', 'Deducciones que más se olvidan', 4, 3, $j$[{"p": "Las deducciones bajan el impuesto, pero solo si tienes cómo probarlas. Estas son las que más se pierden por no guardar el soporte."}, {"opciones": [{"titulo": "Dependientes", "texto": "Un porcentaje de los ingresos laborales, con tope, más un valor adicional por cada dependiente."}, {"titulo": "Medicina prepagada", "texto": "Los pagos de salud prepagada o seguros de salud, con un tope mensual."}, {"titulo": "4 × 1.000", "texto": "La mitad del gravamen a los movimientos financieros pagado en el año."}]}, {"p": "Los topes exactos cambian con la ley y se expresan en UVT. Tu contador los confirma; tú solo asegúrate de tener los certificados."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Revisa qué personas a cargo pueden contar como dependientes.", "href": "/ajustes/miembros", "boton": "Ver personas a cargo"}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_rutas (slug, titulo, portada, descripcion, tema, icono, color, orden, publicada) values ('deudas', 'Deudas sin miedo', 'Deudas sin miedo', 'Bola de nieve vs. avalancha, tarjetas de crédito y cómo negociar.', 'deudas', 'deducciones', 'teja', 6, true);
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('deudas', 'bola-de-nieve-o-avalancha', 'Bola de nieve o avalancha: cuál deuda pagar primero', 4, 1, $j$[{"p": "Si tienes varias deudas y algo de plata extra cada mes, la pregunta es a cuál abonarle primero. Hay dos métodos, y los dos funcionan si los sostienes."}, {"opciones": [{"titulo": "Bola de nieve", "texto": "Pagas primero la deuda más pequeña. Terminarla rápido da impulso para seguir."}, {"titulo": "Avalancha", "texto": "Pagas primero la de mayor tasa de interés. Matemáticamente es la que menos intereses te cobra."}, {"titulo": "En ambos", "texto": "Pagas la cuota mínima de todas y el extra va solo a una. Cuando la terminas, su cuota se suma a la siguiente."}]}, {"p": "Si te cuesta ser constante, empieza con bola de nieve. Si tienes una tarjeta de crédito con interés alto, la avalancha casi siempre gana."}, {"aplica": {"titulo": "Aplícalo en My House", "texto": "Mira cuánto te falta en cada deuda y cuándo terminas.", "href": "/deudas", "boton": "Ver deudas"}}, {"guia": {"id": "deuda", "texto": "Registra tus deudas con la guía para ver el avance."}}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('deudas', 'tarjeta-de-credito', 'La tarjeta de crédito, sin sustos', 3, 2, $j$[{"p": "La tarjeta de crédito no es plata extra: es plata que ya gastaste y debes pagar el día límite. Usada así es una herramienta; usada como ingreso, una trampa."}, {"opciones": [{"titulo": "Paga el total", "texto": "Si pagas el total del periodo antes del día límite, normalmente no pagas intereses."}, {"titulo": "Cuidado con las cuotas", "texto": "Diferir una compra a muchas cuotas cobra intereses en cada una. Para mercado o salidas, a una cuota."}, {"titulo": "Avances", "texto": "Sacar efectivo con la tarjeta suele tener los intereses más altos. Evítalo."}]}, {"p": "En My House el pago de la tarjeta es una transferencia de tu cuenta a la tarjeta: el gasto ya contó el día que compraste. Así no se cuenta doble."}]$j$::jsonb, true, 'Sistema');
insert into public.academia_lecciones (ruta, slug, titulo, minutos, orden, bloques, publicada, editada_por) values ('deudas', 'negociar', 'Cómo negociar una deuda', 3, 3, $j$[{"p": "Si una cuota se volvió imposible, llamar al banco antes de atrasarte es mucho mejor que esperar el cobro. Los bancos prefieren reestructurar a perder la plata."}, {"opciones": [{"titulo": "Prepárate", "texto": "Ten a mano cuánto debes, la tasa, cuánto puedes pagar al mes de verdad y por qué cambió tu situación."}, {"titulo": "Pide opciones", "texto": "Ampliar el plazo, bajar la tasa, unificar deudas o un periodo de gracia."}, {"titulo": "Por escrito", "texto": "Cualquier acuerdo, que quede por escrito antes de pagar."}]}, {"p": "Un plazo más largo baja la cuota pero sube el total pagado. Úsalo para respirar, y cuando puedas, abona a capital."}]$j$::jsonb, true, 'Sistema');

insert into public.academia_recomendaciones (condicion, ruta, leccion, lugares, orden) values
  ('tope_dian', 'renta', 'soportes', '{academia,renta}', 1),
  ('presupuesto_excedido', 'finanzas', 'cuando-te-pasas', '{academia,inicio,presupuesto}', 2),
  ('fondo_atrasado', 'ahorro', 'subir-el-aporte', '{academia,metas}', 3),
  ('sin_fondo', 'ahorro', 'cuanto-fondo', '{academia,metas}', 4),
  ('varias_deudas', 'deudas', 'bola-de-nieve-o-avalancha', '{academia}', 5),
  ('un_miembro_14d', 'pareja', null, '{academia,inicio}', 6),
  ('siempre', 'finanzas', 'numero-minimo', '{academia}', 9);
insert into public.academia_recomendaciones (condicion, ruta, leccion, lugares, orden, activa) values
  ('sin_registro_7d', 'empieza', 'registrar', '{inicio}', 7, false);

do $$
declare
  f text;
begin
  foreach f in array array['academia_vista(text)', 'academia_calificar(text, int)', 'mis_recomendaciones(text)', 'clic_recomendacion(uuid)',
                           'talleres_academia()', 'inscribir_taller(uuid, boolean)', 'consola_academia()', 'consola_guardar_ruta(jsonb)',
                           'consola_guardar_leccion(jsonb)', 'consola_publicar_leccion(uuid, boolean)', 'consola_ordenar_lecciones(text, uuid[])',
                           'consola_guardar_recomendacion(jsonb)', 'consola_guardar_taller(jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.condicion_academia(text, uuid) from public, anon, authenticated;
