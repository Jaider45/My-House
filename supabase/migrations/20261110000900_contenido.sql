-- SaaS S6: parámetros DIAN, catálogos e IA desde la consola, sin desplegar. Todo cambio queda en la auditoría.

-- ═════════════════════════════ Parámetros DIAN ═════════════════════════════
-- Los cambios se guardan como borrador y solo rigen al publicarlos: un año nuevo no existe para los hogares hasta
-- entonces, y en uno publicado siguen los valores anteriores mientras el borrador se revisa.
alter table public.tax_params
  add column publicado    boolean not null default true,
  add column fuente       text check (char_length(fuente) <= 200),
  add column borrador     jsonb,         -- {uvt_valor, topes, deducciones, fuente} por publicar
  add column publicado_en timestamptz,
  add column updated_at   timestamptz not null default now();
update public.tax_params set fuente = 'Resolución DIAN de UVT del año', publicado_en = now();

drop policy tax_params_lectura on public.tax_params;
create policy tax_params_lectura on public.tax_params for select to authenticated using (publicado);
revoke insert, update, delete, truncate on public.tax_params, public.tax_tags from anon, authenticated;

-- Calendario de vencimientos de la declaración de renta de personas naturales: fecha por los dos últimos dígitos
-- de la cédula (00 = 100). `anio_gravable` es el año que se declara (se declara en el siguiente).
create table public.calendario_tributario (
  pais          char(2)  not null,
  anio_gravable int      not null,
  digitos       smallint not null check (digitos between 0 and 99),
  fecha         date     not null,
  primary key (pais, anio_gravable, digitos)
);
alter table public.calendario_tributario enable row level security;
create policy calendario_lectura on public.calendario_tributario for select to authenticated using (true);
revoke insert, update, delete, truncate on public.calendario_tributario from anon, authenticated;

-- Dos últimos dígitos de la cédula de cada adulto (no la cédula entera: es lo único que hace falta para la fecha).
alter table public.members add column nit_digitos text check (nit_digitos ~ '^[0-9]{2}$');

-- Los guarda el administrador del hogar o la propia persona.
create function public.guardar_digitos_cedula(p_member uuid, p_digitos text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member;
  if m.id is null or not (private.tiene_rol(m.household_id, '{admin}') or (m.user_id = auth.uid() and private.tiene_rol(m.household_id, '{admin,editor,contador}'))) then
    raise exception 'No puedes cambiar los datos de esa persona.' using errcode = '42501';
  end if;
  if p_digitos is not null and p_digitos !~ '^[0-9]{2}$' then
    raise exception 'Escribe los dos últimos dígitos de la cédula.';
  end if;
  update public.members set nit_digitos = p_digitos where id = p_member;
end $$;

create function public.consola_parametros(p_pais text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'anios', (select coalesce(jsonb_agg(jsonb_build_object(
                'anio', t.anio, 'uvt_valor', t.uvt_valor, 'topes', t.topes, 'deducciones', t.deducciones, 'fuente', t.fuente,
                'publicado', t.publicado, 'publicado_en', t.publicado_en, 'borrador', t.borrador, 'updated_at', t.updated_at) order by t.anio desc), '[]'::jsonb)
                from public.tax_params t where t.pais = upper(p_pais)),
    'etiquetas', (select coalesce(jsonb_agg(jsonb_build_object('codigo', g.codigo, 'nombre', g.nombre, 'renglon', g.renglon_formulario) order by g.nombre), '[]'::jsonb)
                    from public.tax_tags g where g.pais = upper(p_pais)),
    'calendario', (select coalesce(jsonb_agg(jsonb_build_object('anio', c.anio_gravable, 'fechas', c.fechas) order by c.anio_gravable desc), '[]'::jsonb)
                     from (select k.anio_gravable, jsonb_agg(jsonb_build_object('d', k.digitos, 'fecha', k.fecha) order by k.digitos) as fechas
                             from public.calendario_tributario k where k.pais = upper(p_pais) group by 1) c),
    'personas_con_digitos', (select count(*) from public.members where nit_digitos is not null));
end $$;

create function private.numeros_positivos(j jsonb, permitir_cero boolean) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
     and not exists (select 1 from jsonb_each(j) e
                      where jsonb_typeof(e.value) <> 'number'
                         or (e.value #>> '{}')::numeric < 0
                         or (not permitir_cero and (e.value #>> '{}')::numeric = 0))
$$;

create function public.consola_guardar_parametros(p_pais text, p_anio int, p_uvt bigint, p_topes jsonb, p_deducciones jsonb, p_fuente text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  b jsonb;
begin
  if p_anio is null or p_anio not between 2020 and 2100 then
    raise exception 'Año no válido.';
  end if;
  if p_uvt is null or p_uvt not between 10000 and 10000000 then
    raise exception 'El valor de la UVT no parece correcto.';
  end if;
  if p_topes is null or p_topes = '{}'::jsonb or not private.numeros_positivos(p_topes, false) then
    raise exception 'Los topes deben ser números mayores que cero (en UVT).';
  end if;
  if not private.numeros_positivos(coalesce(p_deducciones, '{}'::jsonb), true) then
    raise exception 'Las deducciones deben ser números.';
  end if;
  b := jsonb_build_object('uvt_valor', p_uvt, 'topes', p_topes, 'deducciones', coalesce(p_deducciones, '{}'::jsonb),
                          'fuente', nullif(left(btrim(coalesce(p_fuente, '')), 200), ''));
  insert into public.tax_params (pais, anio, uvt_valor, topes, deducciones, fuente, publicado, borrador)
  values (upper(p_pais), p_anio, p_uvt, p_topes, coalesce(p_deducciones, '{}'::jsonb), b ->> 'fuente', false, b)
  on conflict (pais, anio) do update set borrador = excluded.borrador, updated_at = now();
  perform private.auditar(s.user_id, s.nombre, 'borrador_parametros', 'parametros', upper(p_pais) || ':' || p_anio,
                          'Parámetros ' || upper(p_pais) || ' ' || p_anio, b);
end $$;

create function public.consola_publicar_parametros(p_pais text, p_anio int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  t public.tax_params;
begin
  select * into t from public.tax_params where pais = upper(p_pais) and anio = p_anio for update;
  if t.id is null or t.borrador is null then
    raise exception 'No hay cambios por publicar.';
  end if;
  update public.tax_params
     set uvt_valor = (t.borrador ->> 'uvt_valor')::bigint, topes = t.borrador -> 'topes', deducciones = t.borrador -> 'deducciones',
         fuente = t.borrador ->> 'fuente', publicado = true, publicado_en = now(), borrador = null, updated_at = now()
   where id = t.id;
  perform private.auditar(s.user_id, s.nombre, 'publico_parametros', 'parametros', t.pais || ':' || t.anio, 'Parámetros ' || t.pais || ' ' || t.anio,
    jsonb_build_object('antes', case when t.publicado then jsonb_build_object('uvt_valor', t.uvt_valor, 'topes', t.topes, 'deducciones', t.deducciones) end,
                       'despues', t.borrador));
end $$;

create function public.consola_descartar_parametros(p_pais text, p_anio int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  t public.tax_params;
begin
  select * into t from public.tax_params where pais = upper(p_pais) and anio = p_anio for update;
  if t.id is null or t.borrador is null then
    raise exception 'No hay borrador.';
  end if;
  if t.publicado then
    update public.tax_params set borrador = null, updated_at = now() where id = t.id;
  else
    delete from public.tax_params where id = t.id;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'descarto_parametros', 'parametros', t.pais || ':' || t.anio, 'Parámetros ' || t.pais || ' ' || t.anio, t.borrador);
end $$;

create function public.consola_guardar_etiqueta(p_pais text, p_codigo text, p_nombre text, p_renglon text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
begin
  if p_codigo !~ '^[a-z0-9_]{2,40}$' then
    raise exception 'El código va en minúsculas, sin espacios (ej.: intereses_vivienda).';
  end if;
  if char_length(btrim(coalesce(p_nombre, ''))) not between 2 and 80 then
    raise exception 'Escribe el nombre de la etiqueta.';
  end if;
  insert into public.tax_tags (pais, codigo, nombre, renglon_formulario)
  values (upper(p_pais), p_codigo, btrim(p_nombre), nullif(left(btrim(coalesce(p_renglon, '')), 20), ''))
  on conflict (pais, codigo) do update set nombre = excluded.nombre, renglon_formulario = excluded.renglon_formulario;
  perform private.auditar(s.user_id, s.nombre, 'guardo_etiqueta_dian', 'etiqueta', upper(p_pais) || ':' || p_codigo, btrim(p_nombre),
                          jsonb_build_object('renglon', p_renglon));
end $$;

-- Reemplaza el calendario de un año gravable completo: 100 terminaciones (00–99), fechas del año siguiente.
create function public.consola_guardar_calendario(p_pais text, p_anio int, p_fechas jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  n int;
begin
  if jsonb_typeof(p_fechas) <> 'array' then
    raise exception 'Formato no válido.';
  end if;
  select count(distinct (e ->> 'd')::int) into n
    from jsonb_array_elements(p_fechas) e
   where (e ->> 'd') ~ '^[0-9]{1,2}$' and (e ->> 'fecha') ~ '^\d{4}-\d{2}-\d{2}$'
     and extract(year from (e ->> 'fecha')::date) = p_anio + 1;
  if n <> 100 or jsonb_array_length(p_fechas) <> 100 then
    raise exception 'El calendario debe cubrir las 100 terminaciones (00 a 99) con fechas de %.', p_anio + 1;
  end if;
  delete from public.calendario_tributario where pais = upper(p_pais) and anio_gravable = p_anio;
  insert into public.calendario_tributario (pais, anio_gravable, digitos, fecha)
  select upper(p_pais), p_anio, (e ->> 'd')::smallint, (e ->> 'fecha')::date from jsonb_array_elements(p_fechas) e;
  perform private.auditar(s.user_id, s.nombre, 'guardo_calendario', 'calendario', upper(p_pais) || ':' || p_anio,
                          'Calendario de renta ' || p_anio, jsonb_build_object('desde', (select min(fecha) from public.calendario_tributario where pais = upper(p_pais) and anio_gravable = p_anio),
                                                                              'hasta', (select max(fecha) from public.calendario_tributario where pais = upper(p_pais) and anio_gravable = p_anio)));
end $$;

-- ═════════════════════════════ Catálogos ═════════════════════════════
-- Categorías con las que nace cada hogar (antes, una lista fija dentro de sembrar_categorias).
create table public.categorias_base (
  id                    uuid primary key default gen_random_uuid(),
  pais                  char(2) not null default 'CO',
  nombre                text not null check (char_length(btrim(nombre)) between 1 and 60),
  padre_id              uuid references public.categorias_base on delete cascade,
  clase                 public.categoria_clase not null default 'gasto',
  tipo                  public.categoria_tipo  not null default 'variable',
  es_esencial           boolean not null default false,
  excluir_de_costo_vida boolean not null default false,
  etiqueta_dian         text,
  orden                 int not null default 0,
  activa                boolean not null default true,
  updated_at            timestamptz not null default now(),
  unique nulls not distinct (pais, padre_id, nombre)
);
alter table public.categorias_base enable row level security; -- solo por las funciones de la consola
revoke all on public.categorias_base from anon, authenticated;

insert into public.categorias_base (nombre, clase, tipo, es_esencial, excluir_de_costo_vida, orden) values
  ('Vivienda',                'gasto',   'fijo',     true,  false, 1),
  ('Servicios públicos',      'gasto',   'fijo',     true,  false, 2),
  ('Mercado',                 'gasto',   'variable', true,  false, 3),
  ('Transporte',              'gasto',   'variable', true,  false, 4),
  ('Educación de los hijos',  'gasto',   'fijo',     true,  false, 5),
  ('Salud',                   'gasto',   'variable', true,  false, 6),
  ('Seguros',                 'gasto',   'fijo',     true,  false, 7),
  ('Deudas',                  'gasto',   'fijo',     true,  false, 8),
  ('Entretenimiento',         'gasto',   'variable', false, false, 9),
  ('Ropa',                    'gasto',   'variable', false, false, 10),
  ('Mascotas',                'gasto',   'variable', false, false, 11),
  ('Imprevistos',             'gasto',   'variable', false, false, 12),
  ('Ahorro e inversión',      'gasto',   'variable', false, true,  13),
  ('Salario',                 'ingreso', 'fijo',     false, false, 14),
  ('Honorarios',              'ingreso', 'variable', false, false, 15),
  ('Arriendos',               'ingreso', 'fijo',     false, false, 16),
  ('Rendimientos financieros','ingreso', 'variable', false, false, 17),
  ('Otros ingresos',          'ingreso', 'variable', false, false, 18);
update public.categorias_base set etiqueta_dian = case nombre
  when 'Salario' then 'rentas_trabajo' when 'Honorarios' then 'honorarios' when 'Arriendos' then 'rentas_capital'
  when 'Rendimientos financieros' then 'rentas_capital' when 'Salud' then 'medicina_prepagada' end;

create or replace function private.sembrar_categorias(p_household uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pais char(2) := coalesce((select pais from public.households where id = p_household), 'CO');
begin
  if not exists (select 1 from public.categorias_base where pais = v_pais and activa) then
    v_pais := 'CO';
  end if;
  insert into public.categories (household_id, nombre, clase, tipo, es_esencial, excluir_de_costo_vida)
  select p_household, b.nombre, b.clase, b.tipo, b.es_esencial, b.excluir_de_costo_vida
    from public.categorias_base b
   where b.pais = v_pais and b.activa and b.padre_id is null;
  insert into public.categories (household_id, padre_id, nombre, clase, tipo, es_esencial, excluir_de_costo_vida)
  select p_household, c.id, b.nombre, b.clase, b.tipo, b.es_esencial, b.excluir_de_costo_vida
    from public.categorias_base b
    join public.categorias_base p on p.id = b.padre_id and p.activa
    join public.categories c on c.household_id = p_household and c.padre_id is null and c.nombre = p.nombre
   where b.pais = v_pais and b.activa;
end $$;

-- Reglas de comercio para todas las familias: se aplican antes que la IA; las del hogar tienen prioridad.
-- `categoria` es el nombre de la categoría (la del hogar con ese nombre; si no la tiene, la regla no aplica).
create table public.reglas_comercio_globales (
  id         uuid primary key default gen_random_uuid(),
  pais       char(2) not null default 'CO',
  patron     text not null check (patron ~ '^[a-z0-9]+( [a-z0-9]+)*$' and char_length(patron) between 2 and 80),
  categoria  text not null check (char_length(btrim(categoria)) between 1 and 60),
  ambito     public.ambito,
  origen     text not null default 'manual' check (origen in ('manual', 'aprendida')),
  activa     boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (pais, patron)
);
alter table public.reglas_comercio_globales enable row level security;
create policy reglas_globales_lectura on public.reglas_comercio_globales for select to authenticated using (activa);
revoke insert, update, delete, truncate on public.reglas_comercio_globales from anon, authenticated;

-- Formatos de extracto por banco: con qué encabezados se reconoce y cómo se leen sus columnas (Mapeo del importador).
create table public.formatos_extracto (
  id          uuid primary key default gen_random_uuid(),
  pais        char(2) not null default 'CO',
  banco       text not null check (char_length(btrim(banco)) between 2 and 60),
  encabezados text[] not null check (cardinality(encabezados) between 2 and 40),
  mapeo       jsonb not null,
  activo      boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.formatos_extracto enable row level security;
create policy formatos_lectura on public.formatos_extracto for select to authenticated using (activo);
revoke insert, update, delete, truncate on public.formatos_extracto from anon, authenticated;

create function public.consola_catalogos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'categorias', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', b.id, 'nombre', b.nombre, 'padre_id', b.padre_id, 'clase', b.clase, 'tipo', b.tipo, 'es_esencial', b.es_esencial,
                     'excluir_de_costo_vida', b.excluir_de_costo_vida, 'etiqueta_dian', b.etiqueta_dian, 'orden', b.orden, 'activa', b.activa,
                     'hogares', (select count(distinct c.household_id) from public.categories c where c.nombre = b.nombre and not c.archivada))
                     order by b.clase, b.orden, b.nombre), '[]'::jsonb)
                     from public.categorias_base b where b.pais = 'CO'),
    'reglas', (select coalesce(jsonb_agg(to_jsonb(g) order by g.patron), '[]'::jsonb) from public.reglas_comercio_globales g),
    -- Reglas que ya aprendieron 3 o más hogares (patrón + categoría con el mismo nombre). Menos de 3 no se muestra:
    -- un patrón de un solo hogar puede ser el nombre de una persona. «ambigua»: otros hogares lo mandan a otra categoría.
    'sugeridas', (select coalesce(jsonb_agg(jsonb_build_object('patron', x.patron, 'categoria', x.categoria, 'hogares', x.hogares, 'ambigua', x.variantes > 1)
                     order by x.hogares desc), '[]'::jsonb)
                    from (select v.* from (select g.*, count(*) over (partition by g.patron) as variantes
                                             from (select mr.patron, c.nombre as categoria, count(distinct mr.household_id)::int as hogares
                                                     from public.merchant_rules mr
                                                     join public.categories c on c.id = mr.category_id
                                                    where mr.activa
                                                      and not exists (select 1 from public.reglas_comercio_globales r where r.patron = mr.patron)
                                                    group by mr.patron, c.nombre) g) v
                           where v.hogares >= 3
                           order by v.hogares desc
                           limit 50) x),
    'formatos', (select coalesce(jsonb_agg(to_jsonb(f) order by f.banco), '[]'::jsonb) from public.formatos_extracto f),
    'etiquetas', (select coalesce(jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre) order by t.nombre), '[]'::jsonb)
                    from public.tax_tags t where t.pais = 'CO'));
end $$;

create function public.consola_guardar_categoria_base(
  p_id uuid, p_nombre text, p_padre uuid, p_clase public.categoria_clase, p_tipo public.categoria_tipo,
  p_esencial boolean, p_excluir boolean, p_etiqueta text, p_orden int, p_activa boolean
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  padre public.categorias_base;
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_nombre, ''))) not between 1 and 60 then
    raise exception 'Escribe el nombre de la categoría.';
  end if;
  if p_padre is not null then
    select * into padre from public.categorias_base where id = p_padre;
    if padre.id is null or padre.padre_id is not null or padre.id = p_id then
      raise exception 'La categoría madre debe ser una categoría principal.';
    end if;
    if padre.clase <> p_clase then
      raise exception 'Una subcategoría es de la misma clase (gasto o ingreso) que su madre.';
    end if;
  end if;
  if p_id is null then
    insert into public.categorias_base (nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, etiqueta_dian, orden, activa)
    values (btrim(p_nombre), p_padre, p_clase, p_tipo, coalesce(p_esencial, false), coalesce(p_excluir, false), nullif(p_etiqueta, ''),
            coalesce(p_orden, 100), coalesce(p_activa, true))
    returning id into v_id;
  else
    update public.categorias_base
       set nombre = btrim(p_nombre), padre_id = p_padre, clase = p_clase, tipo = p_tipo, es_esencial = coalesce(p_esencial, false),
           excluir_de_costo_vida = coalesce(p_excluir, false), etiqueta_dian = nullif(p_etiqueta, ''), orden = coalesce(p_orden, orden),
           activa = coalesce(p_activa, true), updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Esa categoría no existe.';
    end if;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_categoria_base', 'categoria_base', v_id::text, btrim(p_nombre),
    jsonb_build_object('clase', p_clase, 'tipo', p_tipo, 'esencial', p_esencial, 'activa', p_activa, 'padre', p_padre));
  return v_id;
exception when unique_violation then
  raise exception 'Ya hay una categoría con ese nombre en ese nivel.';
end $$;

create function public.consola_guardar_regla_global(p_id uuid, p_patron text, p_categoria text, p_ambito public.ambito, p_activa boolean, p_origen text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  v_id uuid;
begin
  if p_patron is null or p_patron !~ '^[a-z0-9]+( [a-z0-9]+)*$' or char_length(p_patron) not between 2 and 80 then
    raise exception 'El patrón va en minúsculas, sin tildes ni signos (ej.: rappi, exito, terpel).';
  end if;
  if char_length(btrim(coalesce(p_categoria, ''))) not between 1 and 60 then
    raise exception 'Elige la categoría.';
  end if;
  if p_id is null then
    insert into public.reglas_comercio_globales (patron, categoria, ambito, activa, origen)
    values (p_patron, btrim(p_categoria), p_ambito, coalesce(p_activa, true), coalesce(nullif(p_origen, ''), 'manual'))
    on conflict (pais, patron) do update set categoria = excluded.categoria, ambito = excluded.ambito, activa = excluded.activa, updated_at = now()
    returning id into v_id;
  else
    update public.reglas_comercio_globales
       set patron = p_patron, categoria = btrim(p_categoria), ambito = p_ambito, activa = coalesce(p_activa, true), updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Esa regla no existe.';
    end if;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_regla_global', 'regla_comercio', v_id::text, p_patron,
                          jsonb_build_object('categoria', p_categoria, 'ambito', p_ambito, 'activa', p_activa));
  return v_id;
exception when unique_violation then
  raise exception 'Ya hay una regla con ese patrón.';
end $$;

-- Importa reglas en bloque ([{patron, categoria}]); las existentes se actualizan.
create function public.consola_importar_reglas(p_filas jsonb) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  n int;
begin
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) not between 1 and 500 then
    raise exception 'Entre 1 y 500 reglas por vez.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_filas) e
              where coalesce(e ->> 'patron', '') !~ '^[a-z0-9]+( [a-z0-9]+)*$' or char_length(e ->> 'patron') not between 2 and 80
                 or char_length(btrim(coalesce(e ->> 'categoria', ''))) not between 1 and 60) then
    raise exception 'Hay filas con un patrón o una categoría no válidos.';
  end if;
  insert into public.reglas_comercio_globales (patron, categoria)
  select distinct on (e ->> 'patron') e ->> 'patron', btrim(e ->> 'categoria') from jsonb_array_elements(p_filas) e
  on conflict (pais, patron) do update set categoria = excluded.categoria, activa = true, updated_at = now();
  get diagnostics n = row_count;
  perform private.auditar(s.user_id, s.nombre, 'importo_reglas_globales', 'regla_comercio', null, n || ' reglas', jsonb_build_object('reglas', n));
  return n;
end $$;

create function public.consola_guardar_formato(p_id uuid, p_banco text, p_encabezados text[], p_mapeo jsonb, p_activo boolean) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_banco, ''))) not between 2 and 60 then
    raise exception 'Escribe el nombre del banco o del formato.';
  end if;
  if cardinality(p_encabezados) not between 2 and 40 then
    raise exception 'Pega la fila de encabezados del extracto.';
  end if;
  if jsonb_typeof(p_mapeo) <> 'object' or not (p_mapeo ->> 'fecha' = any (p_encabezados)) or not (p_mapeo ->> 'descripcion' = any (p_encabezados))
     or p_mapeo ->> 'modo' not in ('unico', 'separado')
     or (p_mapeo ->> 'modo' = 'unico' and not (p_mapeo ->> 'monto' = any (p_encabezados)))
     or (p_mapeo ->> 'modo' = 'separado' and not (p_mapeo ->> 'debito' = any (p_encabezados) and p_mapeo ->> 'credito' = any (p_encabezados))) then
    raise exception 'Cada columna del mapeo debe ser uno de los encabezados.';
  end if;
  if p_id is null then
    insert into public.formatos_extracto (banco, encabezados, mapeo, activo) values (btrim(p_banco), p_encabezados, p_mapeo, coalesce(p_activo, true))
    returning id into v_id;
  else
    update public.formatos_extracto set banco = btrim(p_banco), encabezados = p_encabezados, mapeo = p_mapeo, activo = coalesce(p_activo, true), updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Ese formato no existe.';
    end if;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_formato_extracto', 'formato_extracto', v_id::text, btrim(p_banco),
                          jsonb_build_object('encabezados', p_encabezados, 'mapeo', p_mapeo, 'activo', p_activo));
  return v_id;
end $$;

-- ═════════════════════════════ IA ═════════════════════════════
-- Umbral de confianza para registrar sin preguntar, tope de gasto del mes (USD; null = sin tope) y precios por
-- modelo (USD por millón de tokens [entrada, salida], por prefijo del nombre). Los precios los carga el equipo.
insert into public.plataforma_config (clave, valor) values
  ('ia_umbral', '70'),
  ('ia_tope_usd_mes', 'null'),
  ('ia_precios', '{}');

alter table public.ia_usos
  add column modelo         text,
  add column tokens_entrada int check (tokens_entrada between 0 and 5000000),
  add column tokens_salida  int check (tokens_salida between 0 and 5000000),
  add column costo_usd      numeric(12, 6),
  add column ms             int check (ms between 0 and 3600000);
create index ia_usos_creado_idx on public.ia_usos (creado_en);

create function private.gasto_ia_mes() returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(costo_usd), 0) from public.ia_usos
   where creado_en >= (date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota')
$$;

create or replace function public.reservar_uso_ia(p_hogar uuid, p_tipo text, p_cantidad int default 1) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  por_hora constant int := 30;   -- lecturas por persona por hora
  por_dia  constant int := 150;  -- lecturas por hogar por día
  usadas_hora int;
  usadas_dia  int;
  del_mes     int;
  tope_mes    int;
  tope_usd    numeric;
begin
  if auth.uid() is null or not private.tiene_rol(p_hogar, '{admin,editor}') then
    raise exception 'Tu rol es de solo lectura.' using errcode = '42501';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 10 then
    raise exception 'Cantidad inválida.';
  end if;

  -- Tope de gasto de la plataforma (consola → IA): frena todas las lecturas hasta el mes siguiente.
  select (valor #>> '{}')::numeric into tope_usd from public.plataforma_config where clave = 'ia_tope_usd_mes' and jsonb_typeof(valor) = 'number';
  if tope_usd is not null and private.gasto_ia_mes() >= tope_usd then
    raise exception 'La lectura con IA está en pausa por el resto del mes. Registra el movimiento a mano mientras tanto.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ia_usos:' || p_hogar::text, 0));

  select count(*) filter (where user_id = auth.uid() and creado_en > now() - interval '1 hour'),
         count(*)
    into usadas_hora, usadas_dia
    from public.ia_usos
   where household_id = p_hogar and creado_en > now() - interval '1 day';

  if usadas_hora + p_cantidad > por_hora then
    raise exception 'Llegaste al límite de % lecturas con IA por hora. Espera un rato y vuelve a intentarlo.', por_hora;
  end if;
  if usadas_dia + p_cantidad > por_dia then
    raise exception 'Tu hogar llegó al límite de % lecturas con IA por día. Vuelve a intentarlo mañana.', por_dia;
  end if;

  tope_mes := private.limite_num(p_hogar, 'comprobantes_mes')::int;
  if tope_mes is not null then
    del_mes := private.comprobantes_mes(p_hogar);
    if del_mes + p_cantidad > tope_mes then
      raise exception 'Usaste las % lecturas con IA del plan % este mes. Mejora tu plan para seguir leyendo comprobantes.',
        tope_mes, private.nombre_plan(p_hogar);
    end if;
  end if;

  insert into public.ia_usos (household_id, user_id, tipo)
  select p_hogar, auth.uid(), p_tipo from generate_series(1, p_cantidad);
end $$;

-- Anota modelo, tokens y tiempo de una lectura en la última reserva sin anotar de esta persona (de los últimos
-- 15 minutos). El costo sale de los precios de la consola, no de quien llama.
create function public.registrar_costo_ia(p_hogar uuid, p_modelo text, p_entrada int, p_salida int, p_ms int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  precios jsonb := coalesce((select valor from public.plataforma_config where clave = 'ia_precios'), '{}'::jsonb);
  precio jsonb;
begin
  if auth.uid() is null or not private.tiene_rol(p_hogar, '{admin,editor}') then
    raise exception 'Tu rol es de solo lectura.' using errcode = '42501';
  end if;
  if p_entrada not between 0 and 5000000 or p_salida not between 0 and 5000000 or p_ms not between 0 and 3600000 then
    raise exception 'Datos de uso no válidos.';
  end if;
  select e.value into precio from jsonb_each(precios) e
   where lower(left(coalesce(p_modelo, ''), 80)) like lower(e.key) || '%'
   order by char_length(e.key) desc limit 1;
  update public.ia_usos
     set modelo = left(p_modelo, 80), tokens_entrada = p_entrada, tokens_salida = p_salida, ms = p_ms,
         costo_usd = case when jsonb_typeof(precio) = 'array'
                          then round((p_entrada * (precio ->> 0)::numeric + p_salida * (precio ->> 1)::numeric) / 1000000.0, 6) end
   where id = (select id from public.ia_usos
                where household_id = p_hogar and user_id = auth.uid() and modelo is null and creado_en > now() - interval '15 minutes'
                order by id desc limit 1);
end $$;

create function public.consola_ia() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  inicio timestamptz := date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'config', (select jsonb_object_agg(clave, valor) from public.plataforma_config where clave like 'ia\_%'),
    'mes', (select jsonb_build_object(
              'lecturas', count(*), 'comprobantes', count(*) filter (where tipo = 'comprobante'), 'extractos', count(*) filter (where tipo = 'extracto'),
              'costo_usd', coalesce(sum(costo_usd), 0), 'sin_precio', count(*) filter (where modelo is not null and costo_usd is null),
              'ms_promedio', coalesce(round(avg(ms))::int, 0), 'hogares', count(distinct household_id))
              from public.ia_usos where creado_en >= inicio),
    'modelos', (select coalesce(jsonb_agg(jsonb_build_object('modelo', modelo, 'lecturas', n, 'costo_usd', c) order by n desc), '[]'::jsonb)
                  from (select modelo, count(*) as n, coalesce(sum(costo_usd), 0) as c from public.ia_usos
                         where creado_en >= inicio and modelo is not null group by modelo) x),
    -- Precisión: comprobantes registrados por la IA este mes cuya categoría nadie cambió después.
    'precision', (select jsonb_build_object('registrados', count(*),
                           'acertados', count(*) filter (where lower(c.nombre) = lower(r.datos ->> 'categoria')))
                    from public.receipts r
                    join public.transactions t on t.id = r.transaction_id
                    left join public.categories c on c.id = t.category_id
                   where r.estado = 'registrado' and r.created_at >= inicio and r.datos ? 'categoria'),
    'meses', (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m.d, 'YYYY-MM'),
                 'lecturas', (select count(*) from public.ia_usos u where date_trunc('month', u.creado_en at time zone 'America/Bogota') = m.d),
                 'costo_usd', (select coalesce(sum(u.costo_usd), 0) from public.ia_usos u where date_trunc('month', u.creado_en at time zone 'America/Bogota') = m.d))
                 order by m.d), '[]'::jsonb)
              from (select date_trunc('month', now() at time zone 'America/Bogota') - make_interval(months => n) as d from generate_series(5, 0, -1) n) m));
end $$;

create function public.consola_guardar_config_ia(p_clave text, p_valor jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
  antes jsonb;
begin
  p_valor := coalesce(p_valor, 'null'::jsonb); -- «sin tope» llega como NULL de SQL
  select valor into antes from public.plataforma_config where clave = p_clave and clave like 'ia\_%' for update;
  if antes is null then
    raise exception 'Esa configuración no existe.';
  end if;
  if p_clave = 'ia_umbral' and (jsonb_typeof(p_valor) <> 'number' or (p_valor #>> '{}')::numeric not between 50 and 100) then
    raise exception 'El umbral va de 50 a 100.';
  end if;
  if p_clave = 'ia_tope_usd_mes' and not (jsonb_typeof(p_valor) = 'null' or (jsonb_typeof(p_valor) = 'number' and (p_valor #>> '{}')::numeric >= 0)) then
    raise exception 'El tope es un valor en dólares (o vacío para no tener tope).';
  end if;
  if p_clave = 'ia_precios' and (jsonb_typeof(p_valor) <> 'object' or exists (
       select 1 from jsonb_each(p_valor) e
        where e.key !~ '^[a-z0-9.\-]{2,60}$' or jsonb_typeof(e.value) <> 'array' or jsonb_array_length(e.value) <> 2
           or jsonb_typeof(e.value -> 0) <> 'number' or jsonb_typeof(e.value -> 1) <> 'number'
           or (e.value ->> 0)::numeric < 0 or (e.value ->> 1)::numeric < 0)) then
    raise exception 'Cada precio es «modelo: entrada, salida» en dólares por millón de tokens.';
  end if;
  update public.plataforma_config set valor = p_valor, updated_at = now() where clave = p_clave;
  perform private.auditar(s.user_id, s.nombre, 'edito_config_ia', 'regla', p_clave, p_clave, jsonb_build_object('antes', antes, 'despues', p_valor));
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'guardar_digitos_cedula(uuid, text)', 'consola_parametros(text)',
    'consola_guardar_parametros(text, int, bigint, jsonb, jsonb, text)', 'consola_publicar_parametros(text, int)',
    'consola_descartar_parametros(text, int)', 'consola_guardar_etiqueta(text, text, text, text)',
    'consola_guardar_calendario(text, int, jsonb)', 'consola_catalogos()',
    'consola_guardar_categoria_base(uuid, text, uuid, public.categoria_clase, public.categoria_tipo, boolean, boolean, text, int, boolean)',
    'consola_guardar_regla_global(uuid, text, text, public.ambito, boolean, text)', 'consola_importar_reglas(jsonb)',
    'consola_guardar_formato(uuid, text, text[], jsonb, boolean)', 'registrar_costo_ia(uuid, text, int, int, int)',
    'consola_ia()', 'consola_guardar_config_ia(text, jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.numeros_positivos(jsonb, boolean) from public, anon, authenticated;
revoke execute on function private.gasto_ia_mes() from public, anon, authenticated;
