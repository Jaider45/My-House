-- Funciones: alta de hogar, invitaciones, recurrentes y reportes.

create function private.hoy() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Bogota')::date
$$;

-- ── Categorías semilla ──────────────────────────────────────────────────────────

create function private.sembrar_categorias(p_household uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.categories (household_id, nombre, clase, tipo, es_esencial, excluir_de_costo_vida)
  values
    (p_household, 'Vivienda',               'gasto',   'fijo',     true,  false),
    (p_household, 'Servicios públicos',     'gasto',   'fijo',     true,  false),
    (p_household, 'Mercado',                'gasto',   'variable', true,  false),
    (p_household, 'Transporte',             'gasto',   'variable', true,  false),
    (p_household, 'Educación de los hijos', 'gasto',   'fijo',     true,  false),
    (p_household, 'Salud',                  'gasto',   'variable', true,  false),
    (p_household, 'Seguros',                'gasto',   'fijo',     true,  false),
    (p_household, 'Deudas',                 'gasto',   'fijo',     true,  false),
    (p_household, 'Entretenimiento',        'gasto',   'variable', false, false),
    (p_household, 'Ropa',                   'gasto',   'variable', false, false),
    (p_household, 'Mascotas',               'gasto',   'variable', false, false),
    (p_household, 'Imprevistos',            'gasto',   'variable', false, false),
    (p_household, 'Ahorro e inversión',     'gasto',   'variable', false, true),
    (p_household, 'Salario',                'ingreso', 'fijo',     false, false),
    (p_household, 'Honorarios',             'ingreso', 'variable', false, false),
    (p_household, 'Arriendos',              'ingreso', 'fijo',     false, false),
    (p_household, 'Rendimientos financieros','ingreso','variable', false, false),
    (p_household, 'Otros ingresos',         'ingreso', 'variable', false, false)
$$;

-- ── Alta de hogar e invitaciones ───────────────────────────────────────────────

create function public.crear_hogar(p_nombre text, p_nombre_miembro text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  h uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'no autenticado';
  end if;
  insert into public.households (nombre) values (btrim(p_nombre)) returning id into h;
  insert into public.members (household_id, user_id, nombre, rol)
    values (h, (select auth.uid()), btrim(p_nombre_miembro), 'admin');
  perform private.sembrar_categorias(h);
  return h;
end $$;

-- Datos mínimos para mostrar la invitación antes de aceptarla (el token es el secreto).
create function public.ver_invitacion(p_token text)
returns table (hogar text, email text, rol public.rol_miembro, vigente boolean)
language sql stable security definer set search_path = '' as $$
  select h.nombre, i.email, i.rol, (i.aceptada_en is null and i.expira_en > now())
  from public.invitations i join public.households h on h.id = i.household_id
  where i.token = p_token
$$;

create function public.aceptar_invitacion(p_token text, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
begin
  if (select auth.uid()) is null then
    raise exception 'no autenticado';
  end if;
  select * into inv from public.invitations
    where token = p_token and aceptada_en is null and expira_en > now()
    for update;
  if not found then
    raise exception 'la invitación no existe o ya venció';
  end if;
  if lower(inv.email) <> lower(coalesce((select auth.jwt()) ->> 'email', '')) then
    raise exception 'la invitación es para otro correo';
  end if;
  insert into public.members (household_id, user_id, nombre, rol)
    values (inv.household_id, (select auth.uid()), btrim(p_nombre), inv.rol)
    on conflict (household_id, user_id) do nothing;
  update public.invitations set aceptada_en = now() where id = inv.id;
  return inv.household_id;
end $$;

-- ── Recurrentes ─────────────────────────────────────────────────────────────────

-- Fecha de la ocurrencia n contada desde el inicio (no acumula: el 31 no se corre al 28).
create function private.siguiente_fecha(p_inicio date, p_frecuencia public.frecuencia, p_n int) returns date
language sql immutable set search_path = '' as $$
  select case p_frecuencia
    when 'semanal'    then p_inicio + 7 * p_n
    when 'quincenal'  then p_inicio + 15 * p_n
    when 'mensual'    then (p_inicio + make_interval(months => p_n))::date
    when 'bimestral'  then (p_inicio + make_interval(months => 2 * p_n))::date
    when 'trimestral' then (p_inicio + make_interval(months => 3 * p_n))::date
    when 'semestral'  then (p_inicio + make_interval(months => 6 * p_n))::date
    when 'anual'      then (p_inicio + make_interval(years => p_n))::date
  end
$$;

-- Genera movimientos 'programado' hasta p_hasta. Idempotente gracias a unique (recurring_rule_id, fecha).
create function private.generar_recurrentes(p_hasta date, p_household uuid default null) returns int
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
    while r.proxima_fecha <= p_hasta loop
      insert into public.transactions
        (household_id, account_id, member_id, fecha, monto, tipo, category_id, comercio,
         estado, origen, recurring_rule_id, created_by)
      values
        (r.household_id, r.account_id, r.member_id, r.proxima_fecha, r.monto, r.tipo, r.category_id,
         r.descripcion, 'programado', 'recurrente', r.id, null)
      on conflict (recurring_rule_id, fecha) do nothing;
      get diagnostics filas = row_count;
      insertados := insertados + filas;
      r.ocurrencias := r.ocurrencias + 1;
      r.proxima_fecha := private.siguiente_fecha(r.fecha_inicio, r.frecuencia, r.ocurrencias);
    end loop;
    update public.recurring_rules
      set proxima_fecha = r.proxima_fecha, ocurrencias = r.ocurrencias
      where id = r.id;
  end loop;
  return insertados;
end $$;

create function public.generar_recurrentes_hogar(p_household uuid) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not private.tiene_rol(p_household, '{admin,editor}') then
    raise exception 'sin permiso';
  end if;
  return private.generar_recurrentes(private.hoy() + 7, p_household);
end $$;

-- ── Reportes (security invoker: respetan RLS) ───────────────────────────────────

create function public.totales_por_categoria(p_household uuid, p_desde date, p_hasta date)
returns table (mes date, category_id uuid, tipo public.mov_tipo, estado public.mov_estado, total bigint, cantidad int)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('month', fecha)::date, category_id, tipo, estado, sum(monto)::bigint, count(*)::int
  from public.transactions
  where household_id = p_household
    and fecha between p_desde and p_hasta
    and tipo <> 'transferencia'
  group by 1, 2, 3, 4
$$;

-- Acumulados del año por persona (miembros no dependientes) para los topes de declarar.
-- Atribución: member_id del movimiento, o el titular de la cuenta.
create function public.acumulados_tributarios(p_household uuid, p_anio int)
returns table (
  member_id uuid, nombre text,
  ingresos_brutos bigint, consumos_tarjeta bigint, compras_consumos bigint,
  consignaciones bigint, patrimonio_bruto bigint
)
language sql stable security invoker set search_path = '' as $$
  with mov as (
    select t.tipo, t.monto, t.fecha,
           coalesce(t.member_id, o.titular_member_id) as persona,
           o.tipo as cuenta_tipo,
           d.tipo as destino_tipo,
           coalesce(d.titular_member_id, t.member_id) as persona_destino
    from public.transactions t
    join public.accounts o on o.id = t.account_id
    left join public.accounts d on d.id = t.cuenta_destino_id
    where t.household_id = p_household
      and t.estado = 'confirmado'
      and t.fecha >= make_date(p_anio, 1, 1)
      and t.fecha <  make_date(p_anio + 1, 1, 1)
  ),
  saldos as (
    select a.titular_member_id as persona,
           a.saldo_inicial + coalesce(sum(case
             when t.account_id = a.id and t.tipo = 'ingreso' then t.monto
             when t.account_id = a.id                        then -t.monto
             when t.cuenta_destino_id = a.id                 then t.monto
           end), 0) as saldo
    from public.accounts a
    left join public.transactions t
      on (t.account_id = a.id or t.cuenta_destino_id = a.id)
     and t.estado = 'confirmado'
     and t.fecha <= make_date(p_anio, 12, 31)
    where a.household_id = p_household and a.titular_member_id is not null
    group by a.id
  )
  select m.id, m.nombre,
    coalesce((select sum(monto) from mov where persona = m.id and tipo = 'ingreso'), 0)::bigint,
    coalesce((select sum(monto) from mov where persona = m.id and tipo = 'gasto' and cuenta_tipo = 'tarjeta'), 0)::bigint,
    coalesce((select sum(monto) from mov where persona = m.id and tipo = 'gasto'), 0)::bigint,
    coalesce((select sum(monto) from mov
              where (tipo = 'ingreso' and cuenta_tipo = 'banco' and persona = m.id)
                 or (tipo = 'transferencia' and destino_tipo = 'banco' and persona_destino = m.id)), 0)::bigint,
    coalesce((select sum(saldo) from saldos where persona = m.id and saldo > 0), 0)::bigint
  from public.members m
  where m.household_id = p_household and not m.es_dependiente
  order by m.created_at
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────────

revoke all on function public.crear_hogar(text, text)                    from public, anon;
revoke all on function public.aceptar_invitacion(text, text)             from public, anon;
revoke all on function public.generar_recurrentes_hogar(uuid)            from public, anon;
revoke all on function public.totales_por_categoria(uuid, date, date)    from public, anon;
revoke all on function public.acumulados_tributarios(uuid, int)          from public, anon;
revoke all on function public.ver_invitacion(text)                       from public;
grant execute on function public.crear_hogar(text, text)                 to authenticated;
grant execute on function public.aceptar_invitacion(text, text)          to authenticated;
grant execute on function public.generar_recurrentes_hogar(uuid)         to authenticated;
grant execute on function public.totales_por_categoria(uuid, date, date) to authenticated;
grant execute on function public.acumulados_tributarios(uuid, int)       to authenticated;
grant execute on function public.ver_invitacion(text)                    to anon, authenticated;
revoke all on function private.generar_recurrentes(date, uuid)           from public, authenticated;
revoke all on function private.sembrar_categorias(uuid)                  from public, authenticated;

-- ── Programación diaria (5:00 a. m. Bogotá = 10:00 UTC) ─────────────────────────

create extension if not exists pg_cron;
select cron.schedule('generar-recurrentes', '0 10 * * *',
                     $$select private.generar_recurrentes(private.hoy() + 7)$$);
