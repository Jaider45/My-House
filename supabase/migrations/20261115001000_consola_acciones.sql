-- Diseño «Admin SaaS»: acciones de Cobros (conciliar con Wompi) y Hogares (crear un hogar para alguien y reenviar
-- una invitación pendiente).

-- Cobros pendientes con una transacción en Wompi (últimos 30 días): el servidor consulta su estado real.
create function public.consola_cobros_por_conciliar() returns table (referencia text, transaccion_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('cobros');
  return query select c.referencia, c.transaccion_id from public.cobros c
                where c.estado in ('pendiente', 'fallido') and c.transaccion_id is not null and c.creado > now() - interval '30 days'
                order by c.creado desc limit 200;
end $$;

-- Crear un hogar para alguien (soporte o ventas): nace sin miembros y con una invitación de administrador.
create function public.consola_crear_hogar(p_nombre text, p_correo text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('usuarios');
  h uuid;
  inv public.invitations;
begin
  if char_length(btrim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Escribe el nombre del hogar.';
  end if;
  if coalesce(p_correo, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Escribe el correo de quien lo va a administrar.';
  end if;
  insert into public.households (nombre, canal) values (btrim(p_nombre), 'consola') returning id into h;
  perform private.sembrar_categorias(h);
  insert into public.invitations (household_id, email, rol, creada_por, expira_en)
  values (h, lower(btrim(p_correo)), 'admin', null, now() + interval '14 days') returning * into inv;
  perform private.auditar(s.user_id, s.nombre, 'creo_hogar', 'hogar', h::text, btrim(p_nombre), jsonb_build_object('admin', lower(btrim(p_correo))));
  return jsonb_build_object('hogar', h, 'token', inv.token, 'email', inv.email);
end $$;

-- Reenviar una invitación pendiente: la extiende 7 días y devuelve el token para mandar el correo otra vez.
create function public.consola_reenviar_invitacion(p_hogar uuid, p_correo text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('usuarios');
  inv public.invitations;
begin
  update public.invitations set expira_en = now() + interval '7 days'
   where household_id = p_hogar and lower(email) = lower(btrim(p_correo)) and aceptada_en is null
  returning * into inv;
  if inv.id is null then
    raise exception 'No hay una invitación pendiente para ese correo.';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'reenvio_invitacion', 'hogar', p_hogar::text, inv.email, '{}'::jsonb);
  return jsonb_build_object('token', inv.token, 'email', inv.email, 'rol', inv.rol,
                            'hogar', (select nombre from public.households where id = p_hogar));
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['consola_cobros_por_conciliar()', 'consola_crear_hogar(text, text)', 'consola_reenviar_invitacion(uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
