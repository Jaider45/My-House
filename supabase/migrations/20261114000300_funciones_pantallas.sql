-- Funciones que muestran las pantallas del diseño «App» y aún no tenían lógica en la base.
--
--  1. Pagos fijos ligados a una deuda (la cuota) o a una meta (el aporte del mes), con número de cuotas, y pagos
--     fijos de transferencia (pagar la tarjeta desde el banco: decisión 9).
--  2. «Generar pagos del mes»: programa ya todas las ocurrencias del mes (normalmente se programan 7 días antes).
--  3. Recordatorios solo para quien los creó o para todo el hogar.
--  4. Cuentas de ahorros o corriente (subtipo de banco).
--  5. Presupuesto de un solo mes («Repetir cada mes» apagado).
--  6. Rol Familiar: ve el hogar y solo registra gastos.
--  7. Invitar por celular (el enlace se comparte por WhatsApp; se acepta con cualquier correo).
--  8. TRM del día (Banco de la República vía datos.gov.co), guardada por el cron.

-- ── 1. Pagos fijos de deuda, meta y transferencia ───────────────────────────────
alter table public.recurring_rules
  drop constraint if exists recurring_rules_tipo_check,
  alter column category_id drop not null,
  add column cuenta_destino_id uuid,
  add column debt_id uuid,
  add column goal_id uuid,
  add column ocurrencias_max int check (ocurrencias_max > 0),
  add foreign key (cuenta_destino_id, household_id) references public.accounts (id, household_id) on delete cascade,
  add foreign key (debt_id, household_id) references public.debts (id, household_id) on delete set null (debt_id),
  add foreign key (goal_id, household_id) references public.budgets_goals (id, household_id) on delete set null (goal_id),
  add constraint recurring_rules_forma check (
    case when tipo = 'transferencia'
         then cuenta_destino_id is not null and category_id is null and cuenta_destino_id <> account_id
         else category_id is not null and cuenta_destino_id is null end);

-- Genera movimientos 'programado' hasta p_hasta. Igual que antes, más: destino de las transferencias, deuda y meta
-- en cada movimiento (así la cuota cuenta como abono y el aporte como ahorro al confirmarlo) y fin tras N cuotas.
create or replace function private.generar_recurrentes(p_hasta date, p_household uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r public.recurring_rules;
  insertados int := 0;
  filas int;
begin
  for r in
    select * from public.recurring_rules
    where activa and proxima_fecha <= p_hasta
      and (p_household is null or household_id = p_household)
    for update skip locked
  loop
    while r.proxima_fecha <= p_hasta and (r.ocurrencias_max is null or r.ocurrencias < r.ocurrencias_max) loop
      insert into public.transactions
        (household_id, account_id, cuenta_destino_id, member_id, fecha, monto, tipo, category_id, comercio,
         estado, origen, recurring_rule_id, debt_id, goal_id, created_by)
      values
        (r.household_id, r.account_id, r.cuenta_destino_id, r.member_id, r.proxima_fecha, r.monto, r.tipo, r.category_id,
         r.descripcion, 'programado', 'recurrente', r.id, r.debt_id, r.goal_id, null)
      on conflict (recurring_rule_id, fecha) do nothing;
      get diagnostics filas = row_count;
      insertados := insertados + filas;
      r.ocurrencias := r.ocurrencias + 1;
      r.proxima_fecha := private.siguiente_fecha(r.fecha_inicio, r.frecuencia, r.ocurrencias);
    end loop;
    update public.recurring_rules
      set proxima_fecha = r.proxima_fecha, ocurrencias = r.ocurrencias,
          activa = r.ocurrencias_max is null or r.ocurrencias < r.ocurrencias_max
      where id = r.id;
  end loop;
  return insertados;
end $$;

-- ── 2. Generar pagos del mes ────────────────────────────────────────────────────
create function public.generar_pagos_mes(p_household uuid) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not private.tiene_rol(p_household, '{admin,editor}') then
    raise exception 'Tu rol es de solo lectura.' using errcode = '42501';
  end if;
  return private.generar_recurrentes(greatest(private.hoy() + 7,
    (date_trunc('month', private.hoy()) + interval '1 month - 1 day')::date), p_household);
end $$;
revoke execute on function public.generar_pagos_mes(uuid) from public, anon;
grant execute on function public.generar_pagos_mes(uuid) to authenticated;

-- ── 3. Recordatorios: a quién avisar ────────────────────────────────────────────
alter table public.reminders
  add column creado_por  uuid default auth.uid() references auth.users on delete set null,
  add column avisar_todos boolean not null default true,
  add column account_id   uuid,
  add foreign key (account_id, household_id) references public.accounts (id, household_id) on delete cascade;

-- ── 4. Cuentas: ahorros o corriente ─────────────────────────────────────────────
alter table public.accounts add column subtipo text check (subtipo in ('ahorros', 'corriente'));

-- ── 5. Presupuesto de un solo mes ───────────────────────────────────────────────
-- `mes` vacío = se repite cada mes; con fecha = solo aplica ese mes (primer día).
alter table public.budgets_goals add column mes date check (mes is null or extract(day from mes) = 1);

create or replace function public.guardar_presupuesto(p_hogar uuid, p_items jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
  if not private.tiene_rol(p_hogar, '{admin,editor}') then
    raise exception 'Tu rol es de solo lectura.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Datos de presupuesto inválidos.';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as i(category_id uuid, monto bigint)
              where i.category_id is null or i.monto is null or i.monto < 0) then
    raise exception 'Datos de presupuesto inválidos.';
  end if;

  delete from public.budgets_goals b
   using jsonb_to_recordset(p_items) as i(category_id uuid, monto bigint)
   where b.household_id = p_hogar and b.tipo = 'presupuesto' and b.category_id = i.category_id and i.monto = 0;

  -- `mes` (opcional, AAAA-MM-01): presupuesto de un solo mes. Sin él, se repite cada mes.
  insert into public.budgets_goals (household_id, tipo, periodo, category_id, monto, mes)
  select distinct on (i.category_id) p_hogar, 'presupuesto', case when i.mes is null then 'mensual' else 'unico' end::public.periodo,
         i.category_id, i.monto, i.mes
    from jsonb_to_recordset(p_items) as i(category_id uuid, monto bigint, mes date)
   where i.monto > 0
  on conflict (household_id, category_id) where tipo = 'presupuesto'
  do update set monto = excluded.monto, mes = excluded.mes, periodo = excluded.periodo;
end $$;

-- ── 6. Rol Familiar ─────────────────────────────────────────────────────────────
-- Registra gastos (confirmados o por pagar) en el hogar; no edita ni borra nada.
create policy transactions_insert_familiar on public.transactions for insert to authenticated
  with check (tipo = 'gasto' and debt_id is null and goal_id is null and recurring_rule_id is null
              and private.tiene_rol(household_id, '{familiar}'));

-- ── 7. Invitar por celular ──────────────────────────────────────────────────────
alter table public.invitations
  alter column email drop not null,
  add column telefono text check (telefono ~ '^3[0-9]{9}$'),
  add constraint invitations_destino check (email is not null or telefono is not null);

-- Igual que antes; la invitación por celular no exige un correo (quien tenga el enlace la acepta, como en la
-- invitación copiada a mano), y el límite de clientes del contador sigue igual.
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.aceptar_invitacion(text, text)'::regprocedure) into def;
  def := replace(def, 'if lower(inv.email) <> lower(coalesce((select auth.jwt()) ->> ''email'', '''')) then',
                      'if inv.email is not null and lower(inv.email) <> lower(coalesce((select auth.jwt()) ->> ''email'', '''')) then');
  execute def;
end $$;

-- ── 8. TRM ──────────────────────────────────────────────────────────────────────
create table public.trm (
  fecha  date primary key,
  valor  numeric(10, 2) not null check (valor > 0),
  fuente text not null default 'datos.gov.co',
  creada timestamptz not null default now()
);
alter table public.trm enable row level security;
create policy trm_select on public.trm for select to authenticated using (true);
revoke insert, update, delete, truncate on public.trm from anon, authenticated;
