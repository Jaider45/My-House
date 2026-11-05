-- Contexto del hogar: personas a cargo con parentesco, edad y quién las declara; parámetros de la deducción
-- por dependientes. El texto libre de contexto y la configuración del asistente (proveedor/modelo de IA)
-- viven en households.config (jsonb), que solo el admin puede editar.

alter table public.members
  add column parentesco       text check (parentesco in ('hijo', 'pareja', 'padre_madre', 'hermano', 'otro')),
  add column fecha_nacimiento date check (fecha_nacimiento > date '1900-01-01'),
  add column a_cargo_de       uuid,
  add column nota             text check (char_length(nota) <= 200),
  add column dependiente_dian boolean not null default false,
  -- Quién lo tiene a cargo (y lo puede reportar como dependiente ante la DIAN): otro miembro del mismo hogar.
  add foreign key (a_cargo_de, household_id) references public.members (id, household_id) on delete set null (a_cargo_de),
  add check (a_cargo_de is distinct from id);

-- Parámetros de deducciones por país y año, en la unidad tributaria (UVT). Colombia:
-- art. 387 E.T.: hasta 10 % de las rentas de trabajo, máximo 32 UVT al mes (384 al año);
-- art. 336 E.T. (Ley 2277 de 2022): 72 UVT adicionales por dependiente, hasta 4.
alter table public.tax_params add column deducciones jsonb not null default '{}';
update public.tax_params
   set deducciones = '{"dependientes_pct": 10, "dependientes_tope_anual": 384, "dependiente_adicional": 72, "dependientes_max": 4}'
 where pais = 'CO';

-- Los niños creados en el onboarding quedan como hijos.
update public.members set parentesco = 'hijo' where es_dependiente and parentesco is null and nombre ~* '^hij';
