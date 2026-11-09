-- Mejoras de docs/mejoras.md:
-- 1) guardar_presupuesto: guarda el gasto variable de varias categorías en una sola llamada y en una transacción
--    (antes eran hasta 2 consultas por categoría, en serie, sin revisar errores: guardado parcial sin aviso).
-- 2) Cupo de uso de la IA (lecturas de comprobantes y extractos PDF): cada llamada al modelo cuesta dinero real.

-- ── 1. Presupuesto ─────────────────────────────────────────────────────────────
-- p_items = [{"category_id": uuid, "monto": entero ≥ 0}]. 0 borra el presupuesto de la categoría.
-- security invoker: corre con RLS como la persona; el chequeo de rol da un mensaje claro en vez de 0 filas.
-- El upsert() de supabase-js no sirve: el índice único budgets_goals_presupuesto_uidx es parcial.
create function public.guardar_presupuesto(p_hogar uuid, p_items jsonb) returns void
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

  insert into public.budgets_goals (household_id, tipo, periodo, category_id, monto)
  select distinct on (i.category_id) p_hogar, 'presupuesto', 'mensual', i.category_id, i.monto
    from jsonb_to_recordset(p_items) as i(category_id uuid, monto bigint)
   where i.monto > 0
  on conflict (household_id, category_id) where tipo = 'presupuesto'
  do update set monto = excluded.monto;
end $$;

revoke execute on function public.guardar_presupuesto(uuid, jsonb) from anon, public;
grant execute on function public.guardar_presupuesto(uuid, jsonb) to authenticated;

-- ── 2. Cupo de la IA ───────────────────────────────────────────────────────────
-- Una fila por llamada al modelo. Solo se escribe con reservar_uso_ia (security definer): sin políticas de
-- insert/delete, nadie puede borrar sus filas para "recargar" el cupo.
create table public.ia_usos (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid references auth.users on delete set null,
  tipo         text not null check (tipo in ('comprobante', 'extracto')),
  creado_en    timestamptz not null default now()
);
create index ia_usos_hogar_idx on public.ia_usos (household_id, creado_en desc);
create index ia_usos_usuario_idx on public.ia_usos (user_id, creado_en desc);

alter table public.ia_usos enable row level security;
create policy ia_usos_select on public.ia_usos for select to authenticated
  using (household_id in (select private.mis_hogares()));

-- Cuenta lo usado en la última hora (por persona) y en el último día (por hogar) y, si hay cupo, registra
-- p_cantidad usos. Todo en una llamada. El candado por hogar evita que dos pedidos simultáneos pasen el tope.
-- Los topes viven aquí (no en el cliente) para que nadie los cambie; en el SaaS dependerán de households.plan.
create function public.reservar_uso_ia(p_hogar uuid, p_tipo text, p_cantidad int default 1) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  por_hora constant int := 30;   -- lecturas por persona por hora
  por_dia  constant int := 150;  -- lecturas por hogar por día
  usadas_hora int;
  usadas_dia  int;
begin
  if auth.uid() is null or not private.tiene_rol(p_hogar, '{admin,editor}') then
    raise exception 'Tu rol es de solo lectura.' using errcode = '42501';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 10 then
    raise exception 'Cantidad inválida.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ia_usos:' || p_hogar::text, 0));

  select count(*) filter (where user_id = auth.uid() and creado_en > now() - interval '1 hour'),
         count(*)
    into usadas_hora, usadas_dia
    from public.ia_usos
   where household_id = p_hogar and creado_en > now() - interval '1 day';

  if usadas_hora + p_cantidad > por_hora then
    raise exception 'Llegaste al límite de % lecturas con IA por hora. Espera un rato y vuelve a intentarlo.', por_hora
      using errcode = 'P0001';
  end if;
  if usadas_dia + p_cantidad > por_dia then
    raise exception 'Tu hogar llegó al límite de % lecturas con IA por día. Vuelve a intentarlo mañana.', por_dia
      using errcode = 'P0001';
  end if;

  insert into public.ia_usos (household_id, user_id, tipo)
  select p_hogar, auth.uid(), p_tipo from generate_series(1, p_cantidad);
end $$;

revoke execute on function public.reservar_uso_ia(uuid, text, int) from anon, public;
grant execute on function public.reservar_uso_ia(uuid, text, int) to authenticated;
