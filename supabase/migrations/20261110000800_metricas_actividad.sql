-- Actividad real = lo que registra una persona. Los movimientos que genera el cron de pagos fijos (origen
-- 'recurrente') no cuentan: si no, un hogar abandonado seguiría «activo» y el evento «primer gasto» se dispararía
-- sin que nadie registrara nada.

drop trigger eventos_primer_gasto on public.transactions;
create trigger eventos_primer_gasto after insert on public.transactions
  for each row when (new.tipo = 'gasto' and new.origen <> 'recurrente') execute function private.evento_primer_gasto();

create function private.mov_activo(o public.mov_origen) returns boolean
language sql immutable set search_path = '' as $$
  select o <> 'recurrente'
$$;

create or replace function private.hogares_segmento(p_segmento text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h.id from public.households h
   where case p_segmento
     when 'todos' then true
     when 'gratis' then h.plan = 'gratis' and not coalesce(h.prueba_hasta > now(), false)
     when 'familia' then h.plan = 'familia'
     when 'prueba' then h.plan = 'gratis' and coalesce(h.prueba_hasta > now(), false)
     when 'mora' then exists (select 1 from public.suscripciones s where s.household_id = h.id and s.estado = 'vencida')
     when 'inactivos' then not exists (select 1 from public.transactions t where t.household_id = h.id
                                         and t.created_at > now() - interval '30 days' and private.mov_activo(t.origen))
     else false
   end
$$;

create or replace function public.consola_metricas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  registrados int;
  pagando int;
  mrr bigint;
  cancel_30 int;
begin
  perform private.exigir_staff('ver_hogares');
  select count(*) into registrados from public.households;
  select count(*), coalesce(sum(case s.periodo when 'anual' then round(s.monto_periodo / 12.0)::bigint else s.monto_periodo end), 0)
    into pagando, mrr
    from public.suscripciones s where s.estado in ('activa', 'vencida');
  select count(*) into cancel_30 from public.eventos where tipo = 'cancelacion' and creado > now() - interval '30 days';

  return jsonb_build_object(
    'registrados', registrados,
    'activos_30d', (select count(distinct t.household_id) from public.transactions t
                     where t.created_at > now() - interval '30 days' and private.mov_activo(t.origen)),
    'nuevos_30d', (select count(*) from public.households where created_at > now() - interval '30 days'),
    'en_prueba', (select count(*) from public.households where plan = 'gratis' and prueba_hasta > now()),
    'pagando', pagando,
    'pagando_familia', (select count(*) from public.suscripciones where estado in ('activa', 'vencida') and plan = 'familia'),
    'pagando_contador', (select count(*) from public.suscripciones where estado in ('activa', 'vencida') and plan = 'contador'),
    'mrr', mrr,
    'arpu', case when pagando = 0 then 0 else round(mrr::numeric / pagando)::bigint end,
    'conversion_pct', case when registrados = 0 then null else round(100.0 * pagando / registrados, 1) end,
    'churn_pct', case when pagando + cancel_30 = 0 then null else round(100.0 * cancel_30 / (pagando + cancel_30), 1) end,
    'embudo', jsonb_build_object(
      'registrados', registrados,
      'pagos_fijos', (select count(*) from public.eventos where tipo = 'pagos_fijos_cargados'),
      'primer_gasto', (select count(*) from public.eventos where tipo = 'primer_gasto'),
      'pareja', (select count(*) from public.eventos where tipo = 'invito_pareja'),
      'pagan', pagando),
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', to_char(w.d, 'YYYY-MM-DD'), 'n',
                  (select count(*) from public.households h where date_trunc('week', h.created_at at time zone 'America/Bogota') = w.d)) order by w.d), '[]'::jsonb)
                from (select date_trunc('week', now() at time zone 'America/Bogota') - make_interval(weeks => n) as d from generate_series(5, 0, -1) n) w),
    'meses', (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m.d, 'YYYY-MM'), 'cobrado',
                 coalesce((select sum(c.monto) from public.cobros c where c.pagado_en is not null
                            and date_trunc('month', c.pagado_en at time zone 'America/Bogota') = m.d), 0)) order by m.d), '[]'::jsonb)
              from (select date_trunc('month', now() at time zone 'America/Bogota') - make_interval(months => n) as d from generate_series(11, 0, -1) n) m));
end $$;

create or replace function public.consola_analitica() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  filas jsonb := '[]'::jsonb;
  c record;
  ret jsonb;
  activos int;
  k int;
  mes_actual date := (date_trunc('month', now() at time zone 'America/Bogota'))::date;
begin
  perform private.exigir_staff('ver_hogares');

  for c in
    select (date_trunc('month', h.created_at at time zone 'America/Bogota'))::date as mes, count(*)::int as n, array_agg(h.id) as ids
      from public.households h
     where h.created_at >= (mes_actual - interval '5 months')
     group by 1 order by 1
  loop
    ret := '[]'::jsonb;
    for k in 0..5 loop
      if c.mes + make_interval(months => k) > mes_actual then
        ret := ret || 'null'::jsonb;
      else
        select count(distinct t.household_id) into activos
          from public.transactions t
         where t.household_id = any (c.ids) and private.mov_activo(t.origen)
           and date_trunc('month', t.created_at at time zone 'America/Bogota') = c.mes + make_interval(months => k);
        ret := ret || to_jsonb(round(100.0 * activos / c.n));
      end if;
    end loop;
    filas := filas || jsonb_build_object('mes', to_char(c.mes, 'YYYY-MM'), 'hogares', c.n, 'ret', ret);
  end loop;

  return jsonb_build_object(
    'cohortes', filas,
    'canales', (select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'hogares', n, 'pagando', pagando) order by n desc), '[]'::jsonb)
                from (select coalesce(nullif(btrim(h.canal), ''), 'directo') as canal, count(*)::int as n,
                             (count(*) filter (where exists (select 1 from public.suscripciones s where s.household_id = h.id and s.estado in ('activa', 'vencida'))))::int as pagando
                        from public.households h group by 1) x),
    'mov_semana_mediana', (select coalesce(round(percentile_cont(0.5) within group (order by n))::int, 0)
                             from (select count(*) as n from public.transactions
                                    where created_at > now() - interval '7 days' and private.mov_activo(origen) group by household_id) x),
    'pareja_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where usuarios >= 2) / count(*)) end
                     from (select h.id, (select count(*) from public.members m where m.household_id = h.id and m.user_id is not null and m.rol <> 'contador') as usuarios
                             from public.households h
                            where exists (select 1 from public.transactions t where t.household_id = h.id
                                            and t.created_at > now() - interval '30 days' and private.mov_activo(t.origen))) x));
end $$;

-- El hogar «pareja» se cuenta sin el contador (que también es una persona con acceso, de solo lectura).
create or replace function private.evento_pareja() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.members m where m.household_id = new.household_id and m.user_id is not null and m.rol <> 'contador') >= 2 then
    perform private.registrar_evento(new.household_id, 'invito_pareja');
  end if;
  return null;
end $$;
