-- Diseño «Admin SaaS» (2026-11-15): Ajustes de la plataforma, insignias de la barra y búsqueda de la franja.
-- Los ajustes viven en `plataforma_config` (lectura pública: nada secreto aquí) y los escribe solo
-- `consola_guardar_ajuste` (permiso `sistema`), que valida la forma de cada clave y deja auditoría.

insert into public.plataforma_config (clave, valor) values
  ('empresa', jsonb_build_object(
     'razon_social', '', 'nit', '', 'correo_contacto', '', 'responsable', '', 'ciudad', 'Bogotá, Colombia',
     'direccion', '', 'telefono', '', 'correo_datos', 'datos@myhousecol.co', 'correo_soporte', 'soporte@myhousecol.co')),
  ('envios', jsonb_build_object('remitente', '', 'responder_a', '', 'wa_desde', '07:00', 'wa_hasta', '20:00', 'wa_sin_marketing_domingo', true)),
  ('cobro_reintentos', '[1, 3, 7]'),
  ('cobro_dia_gratis', '14'),
  ('factura', jsonb_build_object('proveedor', '', 'resolucion', '', 'prefijo', '', 'desde', null, 'hasta', null, 'enviar_correo', true)),
  ('avisos_equipo', jsonb_build_object(
     'pago_fallido', jsonb_build_object('roles', jsonb_build_array('finanzas'), 'activo', true),
     'ticket_urgente', jsonb_build_object('roles', jsonb_build_array('soporte'), 'activo', true),
     'solicitud_1581', jsonb_build_object('roles', jsonb_build_array('superadmin'), 'activo', true),
     'servicio_caido', jsonb_build_object('roles', jsonb_build_array('superadmin'), 'activo', true),
     'plantilla_rechazada', jsonb_build_object('roles', jsonb_build_array('contenido'), 'activo', false))),
  ('limites_app', jsonb_build_object('comprobante_mb', 15, 'exigir_2fa_admins', false, 'intentos_bloqueo', 5))
on conflict (clave) do nothing;

create function public.consola_guardar_ajuste(p_clave text, p_valor jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('sistema');
  antes jsonb;
  k text;
  v jsonb;
begin
  select valor into antes from public.plataforma_config where clave = p_clave for update;
  if antes is null or p_clave not in ('empresa', 'envios', 'cobro_reintentos', 'cobro_dia_gratis', 'factura', 'avisos_equipo', 'limites_app') then
    raise exception 'Ese ajuste no existe.';
  end if;
  if jsonb_typeof(p_valor) = 'object' then
    -- Solo las claves conocidas (las del valor actual) y con el mismo tipo.
    for k, v in select * from jsonb_each(p_valor) loop
      if not antes ? k then
        raise exception 'Campo desconocido: %', k;
      end if;
      if jsonb_typeof(v) = 'string' and char_length(v #>> '{}') > 200 then
        raise exception 'El campo % es demasiado largo.', k;
      end if;
    end loop;
    p_valor := antes || p_valor;
  end if;
  case p_clave
    when 'cobro_reintentos' then
      if jsonb_typeof(p_valor) <> 'array' or jsonb_array_length(p_valor) not between 1 and 5
         or exists (select 1 from jsonb_array_elements(p_valor) d where jsonb_typeof(d) <> 'number' or (d #>> '{}')::int not between 1 and 30) then
        raise exception 'Los reintentos son de 1 a 5 días entre el 1 y el 30.';
      end if;
      select jsonb_agg(d order by (d #>> '{}')::int) into p_valor from (select distinct d from jsonb_array_elements(p_valor) d) x;
    when 'cobro_dia_gratis' then
      if jsonb_typeof(p_valor) <> 'number' or (p_valor #>> '{}')::int not between 7 and 60 then
        raise exception 'El paso a Gratis va entre el día 7 y el 60.';
      end if;
      if (p_valor #>> '{}')::int <= (select max((d #>> '{}')::int) from public.plataforma_config c, jsonb_array_elements(c.valor) d where c.clave = 'cobro_reintentos') then
        raise exception 'El paso a Gratis debe ser después del último reintento.';
      end if;
    when 'empresa' then
      if (p_valor ->> 'correo_contacto') <> '' and (p_valor ->> 'correo_contacto') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'El correo de contacto no es válido.';
      end if;
    when 'envios' then
      if (p_valor ->> 'responder_a') <> '' and (p_valor ->> 'responder_a') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'El correo de «Responder a» no es válido.';
      end if;
      if (p_valor ->> 'wa_desde') !~ '^([01]\d|2[0-3]):[0-5]\d$' or (p_valor ->> 'wa_hasta') !~ '^([01]\d|2[0-3]):[0-5]\d$'
         or (p_valor ->> 'wa_desde') >= (p_valor ->> 'wa_hasta') then
        raise exception 'El horario va de HH:MM a HH:MM y el inicio va antes del fin.';
      end if;
    when 'factura' then
      if (p_valor -> 'desde') <> 'null' and (p_valor -> 'hasta') <> 'null'
         and (p_valor ->> 'desde')::bigint > (p_valor ->> 'hasta')::bigint then
        raise exception 'El rango de facturación empieza antes de terminar.';
      end if;
    when 'limites_app' then
      if (p_valor ->> 'comprobante_mb')::int not between 1 and 25 then
        raise exception 'Un comprobante puede pesar de 1 a 25 MB.';
      end if;
      if (p_valor ->> 'intentos_bloqueo')::int not between 3 and 20 then
        raise exception 'El bloqueo va de 3 a 20 intentos.';
      end if;
    when 'avisos_equipo' then
      for k, v in select * from jsonb_each(p_valor) loop
        if jsonb_typeof(v -> 'activo') <> 'boolean' or jsonb_typeof(v -> 'roles') <> 'array'
           or exists (select 1 from jsonb_array_elements_text(v -> 'roles') r where r not in ('superadmin', 'soporte', 'finanzas', 'contenido')) then
          raise exception 'Aviso % mal formado.', k;
        end if;
      end loop;
    else null;
  end case;
  update public.plataforma_config set valor = p_valor, updated_at = now() where clave = p_clave;
  perform private.auditar(s.user_id, s.nombre, 'edito_ajuste', 'ajuste', p_clave, p_clave, jsonb_build_object('antes', antes, 'despues', p_valor));
end $$;

-- Reintentos y paso a Gratis según los ajustes (antes fijos en 1/3/7 y 14).
create function private.reintentos_cobro() returns int[]
language sql stable set search_path = '' as $$
  select coalesce((select array_agg((d #>> '{}')::int order by (d #>> '{}')::int)
                     from public.plataforma_config c, jsonb_array_elements(c.valor) d where c.clave = 'cobro_reintentos'), '{1,3,7}')
$$;
create function private.dia_gratis() returns int
language sql stable set search_path = '' as $$
  select coalesce((select (valor #>> '{}')::int from public.plataforma_config where clave = 'cobro_dia_gratis'), 14)
$$;

create or replace function public.procesar_vencimientos(p_hoy date) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.suscripciones;
  avisos jsonb := '[]'::jsonb;
  precio bigint;
  descuento bigint;
  cup public.cupones;
  ref text;
  cid uuid;
  mora int;
  h record;
  reintentos int[] := private.reintentos_cobro();
  gratis int := private.dia_gratis();
begin
  for s in select * from public.suscripciones where estado in ('activa', 'vencida') for update loop
    mora := p_hoy - s.vence;

    if s.cancelar_al_vencer and mora >= 0 then
      update public.suscripciones set estado = 'cancelada', updated_at = now() where household_id = s.household_id;
      update public.households set plan = 'gratis' where id = s.household_id;
      update public.cobros set estado = 'anulado' where household_id = s.household_id and estado = 'pendiente';
      avisos := avisos || jsonb_build_object('tipo', 'cancelada', 'hogar', s.household_id, 'plan', s.plan, 'vence', s.vence);
      continue;
    end if;

    if mora >= -3 and not s.cancelar_al_vencer
       and not exists (select 1 from public.cobros c where c.household_id = s.household_id and c.motivo = 'renovacion'
                        and c.periodo_vence = s.vence and c.estado in ('pendiente', 'pagado')) then
      precio := private.precio_plan(s.plan, s.periodo);
      descuento := 0;
      if s.cupon is not null and (s.cupon_periodos_restantes is null or s.cupon_periodos_restantes > 0) then
        select * into cup from public.cupones where codigo = s.cupon;
        if cup.codigo is not null then
          descuento := private.descuento_cupon(cup, s.plan, s.periodo, precio, false);
        end if;
      end if;
      ref := 'MH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      insert into public.cobros (household_id, referencia, plan, periodo, motivo, precio, descuento, monto, cupon, periodo_vence)
      values (s.household_id, ref, s.plan, s.periodo, 'renovacion', precio, descuento, precio - descuento,
              case when descuento > 0 then s.cupon end, s.vence)
      returning id into cid;
      if precio - descuento = 0 then
        perform private.aplicar_pago(cid, null, 'cupon', s.cupon);
        continue;
      end if;
      avisos := avisos || jsonb_build_object('tipo', 'renovacion', 'hogar', s.household_id, 'plan', s.plan,
                                             'periodo', s.periodo, 'vence', s.vence, 'monto', precio - descuento);
    end if;

    if mora >= 1 and s.estado = 'activa' then
      update public.suscripciones set estado = 'vencida', updated_at = now() where household_id = s.household_id;
    end if;
    if mora = any (reintentos) then
      avisos := avisos || jsonb_build_object('tipo', 'mora', 'dia', mora, 'hogar', s.household_id, 'plan', s.plan,
                                             'vence', s.vence, 'baja', s.vence + gratis,
                                             'monto', (select c.monto from public.cobros c where c.household_id = s.household_id
                                                        and c.motivo = 'renovacion' and c.periodo_vence = s.vence
                                                        and c.estado = 'pendiente' limit 1));
    end if;
    if mora >= gratis then
      update public.suscripciones set estado = 'cancelada', updated_at = now() where household_id = s.household_id;
      update public.households set plan = 'gratis' where id = s.household_id;
      update public.cobros set estado = 'anulado' where household_id = s.household_id and estado = 'pendiente';
      avisos := avisos || jsonb_build_object('tipo', 'gratis', 'hogar', s.household_id, 'plan', s.plan, 'vence', s.vence);
    end if;
  end loop;

  for h in select id, prueba_hasta from public.households
            where plan = 'gratis' and (prueba_hasta at time zone 'America/Bogota')::date = p_hoy + 2 loop
    avisos := avisos || jsonb_build_object('tipo', 'prueba', 'hogar', h.id, 'hasta', h.prueba_hasta);
  end loop;

  return avisos;
end $$;

-- Débito automático: el día del vencimiento y en cada reintento configurado.
create or replace function public.cobros_para_debitar(p_hoy date) returns table (referencia text, intentos int, monto bigint, fuente_id bigint,
                                                                      metodo_pago_id uuid, email text, household_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.referencia, c.intentos, c.monto, m.fuente_id, m.id, coalesce(u.email, '')::text, c.household_id
    from public.cobros c
    join public.metodos_pago m on m.household_id = c.household_id and m.activo
    left join auth.users u on u.id = m.creado_por
   where c.motivo = 'renovacion' and c.estado = 'pendiente' and c.monto > 0
     and (p_hoy - c.periodo_vence = 0 or p_hoy - c.periodo_vence = any (private.reintentos_cobro()))
     and c.intentos <= cardinality(private.reintentos_cobro())
     and (c.ultimo_intento is null or (c.ultimo_intento at time zone 'America/Bogota')::date < p_hoy)
$$;

-- Correos del equipo con un rol (para «Avisos para el equipo»): solo service_role.
create function public.correos_del_equipo(p_roles text[]) returns table (nombre text, email text)
language sql stable security definer set search_path = '' as $$
  select s.nombre, u.email::text
    from public.platform_staff s join auth.users u on u.id = s.user_id
   where s.activo and (s.rol::text = any (p_roles) or s.rol = 'superadmin')
$$;
revoke execute on function public.correos_del_equipo(text[]) from public, anon, authenticated;
grant execute on function public.correos_del_equipo(text[]) to service_role;

-- Tickets urgentes o de prioridad alta sin primera respuesta hace más de 1 hora (aviso al equipo, cron).
create function public.tickets_sin_respuesta() returns table (id uuid, numero bigint, asunto text, creado timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.numero, t.asunto, t.created_at from public.tickets t
   where t.estado = 'abierto' and t.primera_respuesta is null and t.prioridad in ('urgente', 'alta')
     and t.created_at < now() - interval '1 hour'
$$;
revoke execute on function public.tickets_sin_respuesta() from public, anon, authenticated;
grant execute on function public.tickets_sin_respuesta() to service_role;

-- Búsqueda de la franja: cobros por referencia o id de transacción (los hogares y usuarios usan sus funciones).
create function public.consola_buscar_cobros(p_q text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := upper(btrim(coalesce(p_q, '')));
begin
  perform private.exigir_staff('ver_hogares');
  if char_length(q) < 4 then
    return '[]'::jsonb;
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'referencia', c.referencia, 'hogar_id', c.household_id, 'hogar', h.nombre,
                   'monto', c.monto, 'estado', c.estado, 'creado', c.creado) order by c.creado desc), '[]'::jsonb)
            from (select * from public.cobros c where upper(c.referencia) like q || '%' or upper(coalesce(c.transaccion_id, '')) = q
                   order by c.creado desc limit 10) c
            join public.households h on h.id = c.household_id);
end $$;

-- Insignias de la barra: lo que espera a alguien del equipo.
create function public.consola_insignias() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'contadores', (select count(*) from public.households h where h.plan = 'contador' and not h.contador_verificado),
    'soporte', (select count(*) from public.tickets where estado = 'abierto' and primera_respuesta is null and prioridad in ('urgente', 'alta')),
    'cobros', (select count(*) from public.suscripciones where estado = 'vencida'));
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['consola_guardar_ajuste(text, jsonb)', 'consola_buscar_cobros(text)', 'consola_insignias()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.reintentos_cobro(), private.dia_gratis() from public, anon, authenticated;
