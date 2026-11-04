-- Catálogo tributario global (por país). Solo lectura para clientes; se escribe con migraciones.

create table public.tax_tags (
  id                 uuid primary key default gen_random_uuid(),
  pais               char(2) not null,
  codigo             text not null,
  nombre             text not null,
  renglon_formulario text,          -- NULL hasta validarlo contra el formulario del año
  unique (pais, codigo)
);

create table public.tax_params (
  id        uuid primary key default gen_random_uuid(),
  pais      char(2) not null,
  anio      int     not null,
  uvt_valor bigint  not null check (uvt_valor > 0),
  topes     jsonb   not null,       -- valores en UVT; los pesos se calculan
  unique (pais, anio)
);

alter table public.tax_tags   enable row level security;
alter table public.tax_params enable row level security;
create policy tax_tags_lectura   on public.tax_tags   for select to authenticated using (true);
create policy tax_params_lectura on public.tax_params for select to authenticated using (true);

insert into public.tax_tags (pais, codigo, nombre) values
  ('CO', 'rentas_trabajo',          'Rentas de trabajo'),
  ('CO', 'honorarios',              'Honorarios'),
  ('CO', 'rentas_capital',          'Rentas de capital'),
  ('CO', 'rentas_no_laborales',     'Rentas no laborales'),
  ('CO', 'pensiones',               'Pensiones'),
  ('CO', 'dividendos',              'Dividendos'),
  ('CO', 'retencion_fuente',        'Retención en la fuente'),
  ('CO', 'intereses_vivienda',      'Intereses de vivienda'),
  ('CO', 'medicina_prepagada',      'Medicina prepagada'),
  ('CO', 'dependientes',            'Dependientes'),
  ('CO', 'aportes_voluntarios_afc', 'Aportes voluntarios pensión / AFC'),
  ('CO', 'gmf',                     'GMF (4×1000)'),
  ('CO', 'factura_electronica',     'Compras con factura electrónica');

insert into public.tax_params (pais, anio, uvt_valor, topes) values
  ('CO', 2025, 49799, '{"patrimonio_bruto": 4500, "ingresos_brutos": 1400, "consumos_tarjeta": 1400, "compras_consumos": 1400, "consignaciones": 1400}'),
  ('CO', 2026, 52374, '{"patrimonio_bruto": 4500, "ingresos_brutos": 1400, "consumos_tarjeta": 1400, "compras_consumos": 1400, "consignaciones": 1400}');
