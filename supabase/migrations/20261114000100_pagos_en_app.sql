-- Pagos dentro de la app (sin redirigir al Web Checkout de Wompi).
--
-- La tarjeta se tokeniza en el navegador directamente contra Wompi (los datos nunca pasan por nuestro servidor);
-- el servidor crea la transacción con ese token o, si la persona eligió guardarla, con una fuente de pago de Wompi
-- (payment_source) que sirve para renovar solo. Nequi: la persona aprueba el cobro en su app de Nequi.
-- Quién da por pagado un cobro sigue siendo `registrar_pago_wompi` (service_role) con la transacción leída de la API
-- de Wompi: por el webhook o porque el servidor la consulta mientras la persona espera en pantalla.

-- La llave privada de Wompi crea fuentes de pago y cobra con ellas.
create or replace function private.campos_integracion(p text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p
    when 'resend'    then '{"config": ["remitente"], "secretos": ["api_key"]}'
    when 'wompi'     then '{"config": ["llave_publica"], "secretos": ["integridad", "eventos", "privada"]}'
    when 'whatsapp'  then '{"config": ["phone_number_id", "waba_id", "verify_token"], "secretos": ["token", "app_secret"]}'
    when 'anthropic' then '{"config": ["modelo"], "secretos": ["api_key"]}'
    when 'openai'    then '{"config": ["modelo"], "secretos": ["api_key"]}'
  end::jsonb
$$;

-- Medios de pago guardados (uno activo por hogar). Solo la referencia de Wompi y lo que se muestra: nunca el número.
create table public.metodos_pago (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  fuente_id    bigint not null,                 -- payment_source de Wompi
  tipo         text not null check (tipo in ('CARD', 'NEQUI')),
  marca        text check (char_length(marca) <= 30),
  ultimos4     text check (ultimos4 ~ '^[0-9]{4}$'),
  vence        text check (vence ~ '^[0-9]{2}/[0-9]{2}$'),
  titular      text check (char_length(titular) <= 80),
  activo       boolean not null default true,
  creado_por   uuid references auth.users on delete set null,
  creado       timestamptz not null default now()
);
create unique index metodos_pago_activo on public.metodos_pago (household_id) where activo;
alter table public.metodos_pago enable row level security;
create policy metodos_pago_select on public.metodos_pago for select to authenticated
  using (exists (select 1 from public.members m where m.household_id = metodos_pago.household_id
                  and m.user_id = (select auth.uid()) and m.rol = 'admin'));
revoke insert, update, delete, truncate on public.metodos_pago from anon, authenticated;

alter table public.cobros
  add column metodo_pago_id uuid references public.metodos_pago on delete set null,
  add column intentos       int not null default 0,
  add column ultimo_intento timestamptz;

-- Guarda la fuente de pago recién creada en Wompi y deja inactiva la anterior. Solo el servidor (service_role).
create function public.guardar_metodo_pago(p_hogar uuid, p_fuente bigint, p_tipo text, p_marca text, p_ultimos4 text,
                                           p_vence text, p_titular text, p_usuario uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  nuevo uuid;
begin
  update public.metodos_pago set activo = false where household_id = p_hogar and activo;
  insert into public.metodos_pago (household_id, fuente_id, tipo, marca, ultimos4, vence, titular, creado_por)
  values (p_hogar, p_fuente, p_tipo, nullif(p_marca, ''), nullif(p_ultimos4, ''), nullif(p_vence, ''), nullif(p_titular, ''), p_usuario)
  returning id into nuevo;
  return nuevo;
end $$;

-- El administrador deja de renovar con la tarjeta guardada (la próxima renovación se paga a mano).
create function public.quitar_metodo_pago(p_hogar uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.exigir_admin_hogar(p_hogar);
  update public.metodos_pago set activo = false where household_id = p_hogar and activo;
end $$;

-- Anota la transacción creada para un cobro (y con qué medio guardado, si fue así). Solo el servidor.
-- Wompi exige una referencia distinta por transacción: el primer intento usa la del cobro y los siguientes
-- `<referencia>.<n>`; `registrar_pago_wompi` encuentra el cobro con la parte antes del punto.
create function public.cobro_transaccion(p_referencia text, p_transaccion text, p_metodo_pago uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.cobros
     set transaccion_id = p_transaccion, metodo_pago_id = coalesce(p_metodo_pago, metodo_pago_id),
         intentos = intentos + 1, ultimo_intento = now(), error = null
   where referencia = split_part(p_referencia, '.', 1) and estado = 'pendiente';
end $$;

-- Igual que antes, salvo: la referencia puede traer el número de intento, y una renovación rechazada sigue
-- pendiente (con el error) para reintentarla con la tarjeta guardada o pagarla a mano.
create or replace function public.registrar_pago_wompi(p_evento text, p_referencia text, p_transaccion text, p_estado text,
                                                       p_monto_centavos bigint, p_metodo text, p_detalle text, p_payload jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.cobros;
  v_resultado text;
begin
  insert into public.eventos_pasarela (id, referencia, estado, payload) values (p_evento, p_referencia, p_estado, p_payload)
    on conflict do nothing;
  if not found then
    return jsonb_build_object('resultado', 'duplicado');
  end if;

  select * into c from public.cobros where referencia = split_part(p_referencia, '.', 1) for update;
  if c.id is null then
    v_resultado := 'desconocido';
  elsif c.estado = 'pagado' then
    v_resultado := 'ya_pagado';
  elsif p_estado = 'APPROVED' then
    if p_monto_centavos <> c.monto * 100 then
      update public.cobros set estado = 'fallido', transaccion_id = p_transaccion, error = 'El monto pagado no coincide.' where id = c.id;
      v_resultado := 'monto_distinto';
    else
      perform private.aplicar_pago(c.id, p_transaccion, p_metodo, p_detalle);
      v_resultado := 'aplicado';
    end if;
  elsif p_estado in ('DECLINED', 'ERROR') then
    update public.cobros set estado = case when estado = 'pendiente' and motivo = 'alta' then 'fallido' else estado end,
           transaccion_id = p_transaccion, metodo = p_metodo, metodo_detalle = p_detalle,
           error = case p_estado when 'DECLINED' then 'Pago rechazado' else 'Error en el pago' end
     where id = c.id;
    v_resultado := 'fallido';
  elsif p_estado = 'VOIDED' then
    update public.cobros set estado = 'anulado', transaccion_id = p_transaccion where id = c.id and estado = 'pendiente' and motivo = 'alta';
    v_resultado := 'anulado';
  else
    update public.cobros set transaccion_id = p_transaccion, metodo = p_metodo, metodo_detalle = p_detalle where id = c.id;
    v_resultado := 'pendiente';
  end if;

  update public.eventos_pasarela set resultado = v_resultado where id = p_evento;
  return jsonb_build_object('resultado', v_resultado, 'hogar', c.household_id, 'cobro', c.id, 'plan', c.plan,
                            'periodo', c.periodo, 'monto', c.monto, 'referencia', c.referencia);
end $$;
revoke execute on function public.registrar_pago_wompi(text, text, text, text, bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_wompi(text, text, text, text, bigint, text, text, jsonb) to service_role;

-- Renovaciones que el cron cobra con la tarjeta guardada: el día del vencimiento y, si falla, los días 1, 3 y 7
-- de mora (máximo 4 intentos, uno por día). Devuelve el correo de quien guardó la tarjeta (Wompi lo exige).
create function public.cobros_para_debitar(p_hoy date) returns table (referencia text, intentos int, monto bigint, fuente_id bigint,
                                                                      metodo_pago_id uuid, email text, household_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.referencia, c.intentos, c.monto, m.fuente_id, m.id, coalesce(u.email, '')::text, c.household_id
    from public.cobros c
    join public.metodos_pago m on m.household_id = c.household_id and m.activo
    left join auth.users u on u.id = m.creado_por
   where c.motivo = 'renovacion' and c.estado = 'pendiente' and c.monto > 0
     and p_hoy - c.periodo_vence in (0, 1, 3, 7)
     and c.intentos < 4
     and (c.ultimo_intento is null or (c.ultimo_intento at time zone 'America/Bogota')::date < p_hoy)
$$;

revoke execute on function public.guardar_metodo_pago(uuid, bigint, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.cobro_transaccion(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.cobros_para_debitar(date) from public, anon, authenticated;
grant execute on function public.guardar_metodo_pago(uuid, bigint, text, text, text, text, text, uuid) to service_role;
grant execute on function public.cobro_transaccion(text, text, uuid) to service_role;
grant execute on function public.cobros_para_debitar(date) to service_role;
revoke execute on function public.quitar_metodo_pago(uuid) from public, anon;
grant execute on function public.quitar_metodo_pago(uuid) to authenticated;

-- Revisión de seguridad: las funciones nuevas de servidor no pueden quedar expuestas.
create or replace function public.revision_seguridad() returns table (tipo text, objeto text)
language sql stable security definer set search_path = '' as $$
  select 'tabla_sin_rls', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select 'vista_sin_security_invoker', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any (c.reloptions) or 'security_invoker=on' = any (c.reloptions), false)
  union all
  select 'funcion_publica_para_anon', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('ver_invitacion', 'consola_ver_invitacion')
  union all
  select 'definer_sin_search_path', n.nspname || '.' || p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)
  union all
  select 'funcion_de_servidor_expuesta', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname in ('registrar_pago_wompi', 'procesar_vencimientos', 'integracion_leer', 'integracion_evento',
                       'correos_de_usuarios', 'revision_seguridad', 'custom_access_token_hook', 'campana_hogares',
                       'campana_reclamar', 'campana_avance', 'purgar_retencion', 'guardar_metodo_pago',
                       'cobro_transaccion', 'cobros_para_debitar')
  union all
  select 'tabla_sensible_accesible', t || ' (' || r || ')'
    from unnest(array['auditoria', 'integraciones', 'staff_invitaciones', 'eventos_pasarela', 'cupones', 'cupones_usos',
                      'hogar_notas', 'avisos_enviados', 'eventos', 'correos_enviados', 'campanas', 'hogar_activo',
                      'registro_tecnico', 'respuestas_guardadas', 'categorias_base']) t
   cross join unnest(array['anon', 'authenticated']) r
   where has_table_privilege(r, 'public.' || t, 'select') or has_table_privilege(r, 'public.' || t, 'insert')
      or has_table_privilege(r, 'public.' || t, 'update') or has_table_privilege(r, 'public.' || t, 'delete')
  union all
  select 'bucket_publico', b.id from storage.buckets b where b.public
$$;
revoke execute on function public.revision_seguridad() from public, anon, authenticated;
grant execute on function public.revision_seguridad() to service_role;
