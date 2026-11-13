-- Diseño «Admin SaaS» → Ofertas y enlaces (ofertas y avisos en la app, enlaces de interés, aliados) y la marca de
-- avisos al equipo ya enviados (Ajustes de la plataforma → Avisos para el equipo).

create table public.avisos_equipo_enviados (
  clave  text primary key,
  creado timestamptz not null default now()
);
alter table public.avisos_equipo_enviados enable row level security;
revoke all on public.avisos_equipo_enviados from anon, authenticated;

-- ───────────────────────── ofertas y avisos ─────────────────────────

create table public.ofertas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(btrim(titulo)) between 3 and 80),
  texto       text not null default '' check (char_length(texto) <= 240),
  etiqueta    text not null default 'Oferta' check (etiqueta in ('Oferta', 'Aviso', 'Novedad', 'Evento')),
  boton_texto text check (char_length(boton_texto) <= 30),
  boton_url   text check (boton_url is null or boton_url ~ '^(https://|/)'),
  lugar       text not null check (lugar in ('inicio', 'academia', 'ajustes', 'metas', 'presupuesto', 'renta', 'pagos')),
  audiencia   text not null default 'todos' check (audiencia in ('todos', 'gratis', 'pago', 'prueba', 'un_miembro', 'sin_metas')),
  desde       date not null default (now() at time zone 'America/Bogota')::date,
  hasta       date check (hasta is null or hasta >= desde),
  publicada   boolean not null default false,
  vistas      int not null default 0,
  clics       int not null default 0,
  creada_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.ofertas enable row level security;
revoke all on public.ofertas from anon, authenticated;

create table public.ofertas_cerradas (
  user_id   uuid not null references auth.users on delete cascade,
  oferta_id uuid not null references public.ofertas on delete cascade,
  creado    timestamptz not null default now(),
  primary key (user_id, oferta_id)
);
alter table public.ofertas_cerradas enable row level security;
revoke all on public.ofertas_cerradas from anon, authenticated;

create function private.oferta_para(o public.ofertas, p_hogar uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select o.publicada and o.desde <= (now() at time zone 'America/Bogota')::date
     and (o.hasta is null or o.hasta >= (now() at time zone 'America/Bogota')::date)
     and case o.audiencia
       when 'todos' then true
       when 'gratis' then private.plan_efectivo(p_hogar) = 'gratis'
       when 'pago' then (select h.plan from public.households h where h.id = p_hogar) <> 'gratis'
       when 'prueba' then (select h.plan = 'gratis' and h.prueba_hasta > now() from public.households h where h.id = p_hogar)
       when 'un_miembro' then (select count(*) from public.members m where m.household_id = p_hogar and m.user_id is not null) = 1
       when 'sin_metas' then not exists (select 1 from public.budgets_goals b where b.household_id = p_hogar and b.tipo = 'meta')
       else false end
$$;

-- La oferta del lugar para quien llama (la más reciente que le aplica y no cerró). Suma una vista.
create function public.mi_oferta(p_lugar text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  h uuid := private.hogar_activo_de(auth.uid());
  o public.ofertas;
begin
  if auth.uid() is null or h is null then
    return null;
  end if;
  select * into o from public.ofertas x
   where x.lugar = p_lugar and private.oferta_para(x, h)
     and not exists (select 1 from public.ofertas_cerradas c where c.user_id = auth.uid() and c.oferta_id = x.id)
   order by x.desde desc, x.created_at desc limit 1;
  if o.id is null then
    return null;
  end if;
  update public.ofertas set vistas = vistas + 1 where id = o.id;
  return jsonb_build_object('id', o.id, 'titulo', o.titulo, 'texto', o.texto, 'etiqueta', o.etiqueta, 'boton_texto', o.boton_texto, 'tiene_enlace', o.boton_url is not null);
end $$;

create function public.cerrar_oferta(p_id uuid) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.ofertas_cerradas (user_id, oferta_id)
  select auth.uid(), p_id where auth.uid() is not null and exists (select 1 from public.ofertas where id = p_id)
  on conflict do nothing
$$;

-- Clic: cuenta y devuelve el destino (solo si la oferta le aplica a quien llama).
create function public.clic_oferta(p_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.ofertas;
begin
  select * into o from public.ofertas where id = p_id;
  if o.id is null or auth.uid() is null or not private.oferta_para(o, private.hogar_activo_de(auth.uid())) then
    return null;
  end if;
  update public.ofertas set clics = clics + 1 where id = p_id;
  return o.boton_url;
end $$;

-- ───────────────────────── enlaces de interés ─────────────────────────

create table public.enlaces (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null check (char_length(btrim(titulo)) between 3 and 90),
  fuente     text not null default '' check (char_length(fuente) <= 60),
  url        text not null check (url ~ '^(https://|/)'),
  categoria  text not null default 'otros' check (categoria in ('dian', 'bancos', 'simuladores', 'academia', 'otros')),
  lugar      text not null check (lugar in ('renta', 'importar', 'metas', 'presupuesto', 'ayuda', 'inicio')),
  orden      int not null default 100,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.enlaces enable row level security;
-- Los enlaces activos los lee cualquiera con sesión (no son datos de nadie).
create policy enlaces_activos on public.enlaces for select to authenticated using (activo);
revoke insert, update, delete, truncate on public.enlaces from anon, authenticated;
revoke all on public.enlaces from anon;

create table public.enlaces_clics (
  id        bigint generated always as identity primary key,
  enlace_id uuid not null references public.enlaces on delete cascade,
  creado    timestamptz not null default now()
);
create index enlaces_clics_idx on public.enlaces_clics (enlace_id, creado desc);
alter table public.enlaces_clics enable row level security;
revoke all on public.enlaces_clics from anon, authenticated;

create function public.clic_enlace(p_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  u text;
begin
  select url into u from public.enlaces where id = p_id and activo;
  if u is null or auth.uid() is null then
    return null;
  end if;
  insert into public.enlaces_clics (enlace_id) values (p_id);
  return u;
end $$;

-- ───────────────────────── aliados ─────────────────────────

create table public.aliados (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (char_length(btrim(nombre)) between 2 and 80),
  tipo       text not null default 'otro' check (tipo in ('contadores', 'ahorro', 'comunidad', 'seguros', 'otro')),
  beneficio  text not null default '' check (char_length(beneficio) <= 160),
  cupon      text,                       -- si el beneficio es un cupón, sus usos salen de cupones_usos
  url        text check (url is null or url ~ '^https://'),
  estado     text not null default 'negociacion' check (estado in ('negociacion', 'activo', 'pausado')),
  notas      text check (char_length(notas) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.aliados enable row level security;
revoke all on public.aliados from anon, authenticated;

-- ───────────────────────── consola ─────────────────────────

create function public.consola_ofertas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'ofertas', (select coalesce(jsonb_agg(to_jsonb(o) order by o.publicada desc, o.desde desc), '[]'::jsonb) from public.ofertas o),
    'enlaces', (select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('clics_30d',
                   (select count(*) from public.enlaces_clics c where c.enlace_id = e.id and c.creado > now() - interval '30 days'))
                   order by e.lugar, e.orden, e.titulo), '[]'::jsonb) from public.enlaces e),
    'aliados', (select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('usos',
                   case when a.cupon is null then null else (select count(distinct u.household_id) from public.cupones_usos u where u.cupon = a.cupon) end)
                   order by a.estado, a.nombre), '[]'::jsonb) from public.aliados a),
    'cupones', (select coalesce(jsonb_agg(c.codigo order by c.codigo), '[]'::jsonb) from public.cupones c));
end $$;

create function public.consola_guardar_oferta(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  nid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if nid is null then
    insert into public.ofertas (titulo, texto, etiqueta, boton_texto, boton_url, lugar, audiencia, desde, hasta, publicada, creada_por)
    values (btrim(p ->> 'titulo'), coalesce(p ->> 'texto', ''), coalesce(p ->> 'etiqueta', 'Oferta'), nullif(btrim(coalesce(p ->> 'boton_texto', '')), ''),
            nullif(btrim(coalesce(p ->> 'boton_url', '')), ''), p ->> 'lugar', coalesce(p ->> 'audiencia', 'todos'),
            coalesce((p ->> 'desde')::date, (now() at time zone 'America/Bogota')::date), (p ->> 'hasta')::date, coalesce((p ->> 'publicada')::boolean, false), s.nombre)
    returning id into nid;
  else
    update public.ofertas set titulo = btrim(p ->> 'titulo'), texto = coalesce(p ->> 'texto', ''), etiqueta = coalesce(p ->> 'etiqueta', 'Oferta'),
      boton_texto = nullif(btrim(coalesce(p ->> 'boton_texto', '')), ''), boton_url = nullif(btrim(coalesce(p ->> 'boton_url', '')), ''),
      lugar = p ->> 'lugar', audiencia = coalesce(p ->> 'audiencia', 'todos'), desde = coalesce((p ->> 'desde')::date, desde), hasta = (p ->> 'hasta')::date,
      publicada = coalesce((p ->> 'publicada')::boolean, false), updated_at = now()
     where id = nid;
    if not found then
      raise exception 'Esa oferta no existe.';
    end if;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_oferta', 'oferta', nid::text, btrim(p ->> 'titulo'), p - 'id');
  return nid;
end $$;

create function public.consola_guardar_enlace(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  nid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if coalesce((p ->> 'borrar')::boolean, false) then
    delete from public.enlaces where id = nid;
    perform private.auditar(s.user_id, s.nombre, 'borro_enlace', 'enlace', nid::text, null, '{}'::jsonb);
    return nid;
  end if;
  if nid is null then
    insert into public.enlaces (titulo, fuente, url, categoria, lugar, orden, activo)
    values (btrim(p ->> 'titulo'), coalesce(btrim(p ->> 'fuente'), ''), btrim(p ->> 'url'), coalesce(p ->> 'categoria', 'otros'), p ->> 'lugar',
            coalesce((p ->> 'orden')::int, 100), coalesce((p ->> 'activo')::boolean, true))
    returning id into nid;
  else
    update public.enlaces set titulo = btrim(p ->> 'titulo'), fuente = coalesce(btrim(p ->> 'fuente'), ''), url = btrim(p ->> 'url'),
      categoria = coalesce(p ->> 'categoria', 'otros'), lugar = p ->> 'lugar', orden = coalesce((p ->> 'orden')::int, 100), activo = coalesce((p ->> 'activo')::boolean, true)
     where id = nid;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_enlace', 'enlace', nid::text, btrim(p ->> 'titulo'), p - 'id');
  return nid;
end $$;

create function public.consola_guardar_aliado(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  nid uuid := nullif(p ->> 'id', '')::uuid;
  cup text := nullif(upper(btrim(coalesce(p ->> 'cupon', ''))), '');
begin
  if cup is not null and not exists (select 1 from public.cupones where codigo = cup) then
    raise exception 'El cupón % no existe (créalo en Planes y cupones).', cup;
  end if;
  if nid is null then
    insert into public.aliados (nombre, tipo, beneficio, cupon, url, estado, notas)
    values (btrim(p ->> 'nombre'), coalesce(p ->> 'tipo', 'otro'), coalesce(btrim(p ->> 'beneficio'), ''), cup, nullif(btrim(coalesce(p ->> 'url', '')), ''),
            coalesce(p ->> 'estado', 'negociacion'), nullif(btrim(coalesce(p ->> 'notas', '')), ''))
    returning id into nid;
  else
    update public.aliados set nombre = btrim(p ->> 'nombre'), tipo = coalesce(p ->> 'tipo', 'otro'), beneficio = coalesce(btrim(p ->> 'beneficio'), ''),
      cupon = cup, url = nullif(btrim(coalesce(p ->> 'url', '')), ''), estado = coalesce(p ->> 'estado', 'negociacion'), notas = nullif(btrim(coalesce(p ->> 'notas', '')), '')
     where id = nid;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_aliado', 'aliado', nid::text, btrim(p ->> 'nombre'), p - 'id');
  return nid;
end $$;

-- Ejemplos útiles de enlaces de interés (fuentes oficiales; el equipo los cambia en la consola).
insert into public.enlaces (titulo, fuente, url, categoria, lugar, orden) values
  ('Consulta de RUT y calendario tributario', 'dian.gov.co', 'https://www.dian.gov.co', 'dian', 'renta', 1),
  ('Comparador de tasas de ahorro', 'Superintendencia Financiera', 'https://www.superfinanciera.gov.co', 'simuladores', 'metas', 1);

do $$
declare
  f text;
begin
  foreach f in array array['mi_oferta(text)', 'cerrar_oferta(uuid)', 'clic_oferta(uuid)', 'clic_enlace(uuid)', 'consola_ofertas()',
                           'consola_guardar_oferta(jsonb)', 'consola_guardar_enlace(jsonb)', 'consola_guardar_aliado(jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.oferta_para(public.ofertas, uuid) from public, anon, authenticated;
