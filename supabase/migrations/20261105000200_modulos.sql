-- Módulos del diseño: ámbito personal/negocio, cuentas con datos de tarjeta, deudas, metas de ahorro,
-- presupuesto por categoría, recordatorios y el asistente de comprobantes.

-- ── Hogar y movimientos ────────────────────────────────────────────────────────
alter table public.households add column ciudad text check (char_length(ciudad) <= 60);

create type public.ambito as enum ('personal', 'negocio');
alter table public.transactions add column ambito public.ambito not null default 'personal';

-- ── Cuentas: billeteras y datos de tarjeta ─────────────────────────────────────
alter type public.cuenta_tipo add value if not exists 'billetera';
alter table public.accounts
  add column entidad   text check (char_length(entidad) <= 60),
  add column ultimos4  char(4) check (ultimos4 ~ '^[0-9]{4}$'),
  add column cupo      bigint check (cupo > 0),
  add column dia_corte smallint check (dia_corte between 1 and 31),
  add column dia_pago  smallint check (dia_pago between 1 and 31);

-- ── Deudas ─────────────────────────────────────────────────────────────────────
-- Lo pagado = pagado_inicial (antes de usar My House) + los movimientos con debt_id.
create table public.debts (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  nombre         text not null check (char_length(btrim(nombre)) between 1 and 80),
  detalle        text check (char_length(detalle) <= 120),
  monto          bigint not null check (monto > 0),
  pagado_inicial bigint not null default 0 check (pagado_inicial >= 0),
  cuota          bigint check (cuota > 0),              -- null = abonos libres
  cuotas_total   smallint check (cuotas_total > 0),
  dia_pago       smallint check (dia_pago between 1 and 31),
  fecha_limite   date,
  member_id      uuid,
  archivada      boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (id, household_id),
  foreign key (member_id, household_id) references public.members (id, household_id)
);
create index debts_household_idx on public.debts (household_id);

-- ── Metas de ahorro (budgets_goals tipo 'meta') y presupuesto (tipo 'presupuesto') ──
-- Meta: monto = objetivo; ahorrado = ahorrado_inicial + movimientos con goal_id.
-- Presupuesto: monto = adicional del mes sobre los pagos fijos de la categoría.
alter table public.budgets_goals
  add column ahorrado_inicial bigint not null default 0 check (ahorrado_inicial >= 0),
  add column aporte_mensual   bigint check (aporte_mensual > 0),
  add column icono            text check (char_length(icono) <= 30),
  add column es_emergencia    boolean not null default false,
  add constraint budgets_goals_id_household_key unique (id, household_id);
create unique index budgets_goals_presupuesto_uidx on public.budgets_goals (household_id, category_id)
  where tipo = 'presupuesto';

alter table public.transactions
  add column debt_id uuid,
  add column goal_id uuid,
  add foreign key (debt_id, household_id) references public.debts (id, household_id) on delete set null (debt_id),
  add foreign key (goal_id, household_id) references public.budgets_goals (id, household_id) on delete set null (goal_id);
create index transactions_debt_idx on public.transactions (debt_id) where debt_id is not null;
create index transactions_goal_idx on public.transactions (goal_id) where goal_id is not null;

-- ── Recordatorios ──────────────────────────────────────────────────────────────
create type public.repeticion as enum ('una_vez', 'mensual', 'anual');
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  nombre       text not null check (char_length(btrim(nombre)) between 1 and 80),
  fecha        date not null,
  monto        bigint check (monto > 0),
  repetir      public.repeticion not null default 'una_vez',
  avisos       smallint[] not null default '{1}' check (avisos <@ '{0,1,3,7,14,30}'::smallint[]),
  canales      text[] not null default '{notificacion}' check (canales <@ '{whatsapp,correo,notificacion}'::text[]),
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index reminders_household_idx on public.reminders (household_id, fecha);
alter table public.recurring_rules add column recordar boolean not null default true;

-- ── Asistente de comprobantes ──────────────────────────────────────────────────
create type public.comprobante_estado as enum ('procesando', 'registrado', 'soporte', 'por_revisar', 'descartado', 'error');
create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  created_by     uuid default auth.uid() references auth.users on delete set null,
  archivo_path   text,                                  -- {household_id}/comprobantes/{id}.{ext} en "soportes"
  nombre_archivo text check (char_length(nombre_archivo) <= 200),
  mime           text,
  estado         public.comprobante_estado not null default 'procesando',
  datos          jsonb not null default '{}',           -- lo que leyó el modelo
  pregunta       text,                                  -- lo que falta para registrarlo
  transaction_id uuid,
  created_at     timestamptz not null default now(),
  unique (id, household_id),
  check (archivo_path is null or split_part(archivo_path, '/', 1) = household_id::text),
  foreign key (transaction_id, household_id) references public.transactions (id, household_id) on delete set null (transaction_id)
);
create index receipts_household_idx on public.receipts (household_id, created_at desc);

create table public.assistant_messages (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  autor        text not null check (autor in ('usuario', 'asistente')),
  created_by   uuid default auth.uid() references auth.users on delete set null,
  texto        text not null default '' check (char_length(texto) <= 4000),
  receipt_ids  uuid[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index assistant_messages_household_idx on public.assistant_messages (household_id, created_at);

-- Reglas aprendidas: comercio normalizado → categoría (y ámbito).
create table public.merchant_rules (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  patron       text not null check (char_length(patron) between 2 and 80),
  category_id  uuid not null,
  ambito       public.ambito,
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (household_id, patron),
  foreign key (category_id, household_id) references public.categories (id, household_id) on delete cascade
);

-- ── RLS uniforme (igual que 0300): leen todos los miembros, escriben admin y editor ──
do $$
declare t text;
begin
  foreach t in array array['debts', 'reminders', 'receipts', 'assistant_messages', 'merchant_rules'] loop
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

create trigger receipts_autor before insert on public.receipts
  for each row execute function private.fijar_autor();
create trigger receipts_conservar_autor before update on public.receipts
  for each row execute function private.conservar_autor();
create trigger assistant_messages_autor before insert on public.assistant_messages
  for each row execute function private.fijar_autor();
