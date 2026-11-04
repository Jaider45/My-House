-- Finanzas: cuentas, categorías, recurrentes, importaciones, movimientos, adjuntos y metas.
-- Todas las referencias entre tablas usan FK compuesta (id, household_id): no se puede apuntar a otro hogar.

create type public.cuenta_tipo     as enum ('banco', 'efectivo', 'tarjeta');
create type public.categoria_clase as enum ('gasto', 'ingreso');
create type public.categoria_tipo  as enum ('fijo', 'variable');
create type public.mov_tipo        as enum ('ingreso', 'gasto', 'transferencia');
create type public.mov_estado      as enum ('confirmado', 'programado');
create type public.mov_origen      as enum ('manual', 'importacion', 'recurrente', 'ocr', 'whatsapp', 'banco');
create type public.adjunto_tipo    as enum ('factura', 'certificado', 'extracto');
create type public.frecuencia      as enum ('semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual');
create type public.meta_tipo       as enum ('presupuesto', 'meta');
create type public.periodo         as enum ('mensual', 'anual', 'unico');

create table public.accounts (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households on delete cascade,
  tipo              public.cuenta_tipo not null,
  nombre            text not null check (char_length(btrim(nombre)) between 1 and 80),
  saldo_inicial     bigint not null default 0,
  titular_member_id uuid,
  mapeo_csv         jsonb,
  archivada         boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (id, household_id),
  foreign key (titular_member_id, household_id) references public.members (id, household_id)
    on delete set null (titular_member_id)
);
create index accounts_household_idx on public.accounts (household_id);

create table public.categories (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households on delete cascade,
  nombre                text not null check (char_length(btrim(nombre)) between 1 and 60),
  padre_id              uuid,
  clase                 public.categoria_clase not null default 'gasto',
  tipo                  public.categoria_tipo  not null default 'variable',
  es_esencial           boolean not null default false,
  excluir_de_costo_vida boolean not null default false,
  archivada             boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (id, household_id),
  unique nulls not distinct (household_id, padre_id, nombre),
  foreign key (padre_id, household_id) references public.categories (id, household_id) on delete restrict
);
create index categories_household_idx on public.categories (household_id);

create table public.recurring_rules (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households on delete cascade,
  descripcion   text not null check (char_length(btrim(descripcion)) between 1 and 120),
  monto         bigint not null check (monto > 0),
  tipo          public.mov_tipo not null default 'gasto' check (tipo <> 'transferencia'),
  account_id    uuid not null,
  category_id   uuid not null,
  member_id     uuid,
  frecuencia    public.frecuencia not null,
  fecha_inicio  date not null,
  proxima_fecha date not null,
  ocurrencias   int  not null default 0 check (ocurrencias >= 0),
  activa        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (id, household_id),
  foreign key (account_id, household_id)  references public.accounts (id, household_id) on delete cascade,
  foreign key (category_id, household_id) references public.categories (id, household_id),
  foreign key (member_id, household_id)   references public.members (id, household_id) on delete set null (member_id)
);
create index recurring_rules_household_idx on public.recurring_rules (household_id);
create index recurring_rules_pendientes_idx on public.recurring_rules (proxima_fecha) where activa;

create table public.import_batches (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households on delete cascade,
  account_id       uuid not null,
  archivo_nombre   text not null,
  filas_total      int not null check (filas_total >= 0),
  filas_importadas int not null check (filas_importadas >= 0),
  filas_duplicadas int not null check (filas_duplicadas >= 0),
  created_by       uuid default auth.uid() references auth.users on delete set null,
  created_at       timestamptz not null default now(),
  unique (id, household_id),
  foreign key (account_id, household_id) references public.accounts (id, household_id) on delete cascade
);
create index import_batches_household_idx on public.import_batches (household_id);

create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households on delete cascade,
  account_id        uuid not null,
  cuenta_destino_id uuid,
  member_id         uuid,
  fecha             date not null,
  monto             bigint not null check (monto > 0),
  tipo              public.mov_tipo not null,
  category_id       uuid,
  tax_tag_id        uuid references public.tax_tags,
  comercio          text check (char_length(comercio) <= 200),
  nota              text check (char_length(nota) <= 1000),
  estado            public.mov_estado not null default 'confirmado',
  origen            public.mov_origen not null default 'manual',
  recurring_rule_id uuid,
  import_batch_id   uuid,
  import_hash       text,
  created_by        uuid default auth.uid() references auth.users on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, household_id),
  unique (account_id, import_hash),
  unique (recurring_rule_id, fecha),
  check ((tipo = 'transferencia') = (cuenta_destino_id is not null)),
  check (tipo <> 'transferencia' or category_id is null),
  check (cuenta_destino_id is distinct from account_id),
  foreign key (account_id, household_id)        references public.accounts (id, household_id) on delete cascade,
  foreign key (cuenta_destino_id, household_id) references public.accounts (id, household_id) on delete cascade,
  foreign key (member_id, household_id)         references public.members (id, household_id) on delete set null (member_id),
  foreign key (category_id, household_id)       references public.categories (id, household_id),
  foreign key (recurring_rule_id, household_id) references public.recurring_rules (id, household_id) on delete set null (recurring_rule_id),
  foreign key (import_batch_id, household_id)   references public.import_batches (id, household_id) on delete cascade
);
create index transactions_household_fecha_idx on public.transactions (household_id, fecha desc);
create index transactions_account_fecha_idx   on public.transactions (account_id, fecha);
create index transactions_destino_idx         on public.transactions (cuenta_destino_id) where cuenta_destino_id is not null;
create index transactions_category_idx        on public.transactions (category_id);

create table public.attachments (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  transaction_id uuid not null,
  archivo_path   text not null unique,     -- {household_id}/{transaction_id}/{archivo}
  tipo           public.adjunto_tipo not null,
  created_at     timestamptz not null default now(),
  check (split_part(archivo_path, '/', 1) = household_id::text),
  foreign key (transaction_id, household_id) references public.transactions (id, household_id) on delete cascade
);
create index attachments_transaction_idx on public.attachments (transaction_id);

create table public.budgets_goals (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  tipo           public.meta_tipo not null,
  nombre         text,
  category_id    uuid,
  monto          bigint not null check (monto > 0),
  periodo        public.periodo not null,
  fecha_objetivo date,
  created_at     timestamptz not null default now(),
  foreign key (category_id, household_id) references public.categories (id, household_id) on delete cascade
);
create index budgets_goals_household_idx on public.budgets_goals (household_id);

-- Validaciones que no caben en un check

create function private.validar_categoria() returns trigger
language plpgsql set search_path = '' as $$
declare
  padre public.categories;
begin
  if new.padre_id is not null then
    select * into padre from public.categories where id = new.padre_id;
    if padre.padre_id is not null then
      raise exception 'las categorías solo admiten dos niveles';
    end if;
    if padre.clase <> new.clase then
      raise exception 'la subcategoría debe ser de la misma clase que su padre';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.categories where padre_id = new.id) then
      raise exception 'una categoría con subcategorías no puede volverse subcategoría';
    end if;
  end if;
  return new;
end $$;

create trigger categories_validar before insert or update of padre_id, clase on public.categories
  for each row execute function private.validar_categoria();

create function private.validar_movimiento() returns trigger
language plpgsql set search_path = '' as $$
declare
  clase_cat public.categoria_clase;
begin
  if new.category_id is not null then
    select clase into clase_cat from public.categories where id = new.category_id;
    if clase_cat::text <> new.tipo::text then
      raise exception 'la categoría (%) no corresponde al tipo de movimiento (%)', clase_cat, new.tipo;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger transactions_validar before insert or update on public.transactions
  for each row execute function private.validar_movimiento();

create function private.validar_regla() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select clase from public.categories where id = new.category_id)::text <> new.tipo::text then
    raise exception 'la categoría no corresponde al tipo de la regla';
  end if;
  return new;
end $$;

create trigger recurring_rules_validar before insert or update on public.recurring_rules
  for each row execute function private.validar_regla();

-- RLS uniforme: los miembros leen; admin y editor escriben; contador solo lee.
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'recurring_rules', 'import_batches',
                           'transactions', 'attachments', 'budgets_goals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %1$s_select on public.%1$I for select to authenticated
                      using (household_id in (select private.mis_hogares()))$p$, t);
    execute format($p$create policy %1$s_insert on public.%1$I for insert to authenticated
                      with check (private.tiene_rol(household_id, '{admin,editor}'))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$I for update to authenticated
                      using (private.tiene_rol(household_id, '{admin,editor}'))
                      with check (private.tiene_rol(household_id, '{admin,editor}'))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$I for delete to authenticated
                      using (private.tiene_rol(household_id, '{admin,editor}'))$p$, t);
  end loop;
end $$;

-- Saldo de cada cuenta (solo movimientos confirmados). En tarjetas, negativo = deuda.
create view public.account_balances with (security_invoker = true) as
select a.id as account_id,
       a.household_id,
       a.saldo_inicial + coalesce(sum(case
         when t.account_id = a.id and t.tipo = 'ingreso' then t.monto
         when t.account_id = a.id                        then -t.monto
         when t.cuenta_destino_id = a.id                 then t.monto
       end), 0)::bigint as saldo
from public.accounts a
left join public.transactions t
  on (t.account_id = a.id or t.cuenta_destino_id = a.id) and t.estado = 'confirmado'
group by a.id;
