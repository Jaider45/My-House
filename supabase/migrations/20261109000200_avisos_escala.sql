-- /api/avisos leía TODA la lista de usuarios de Auth (listUsers de 1000 en 1000) en cada ejecución. Esta función
-- devuelve solo los correos de los usuarios pedidos (los admin/editor de los hogares de la tanda), en una llamada.
-- Solo service_role: expone correos de cualquier usuario.
create function public.correos_de_usuarios(p_ids uuid[]) returns table (id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text from auth.users u where u.id = any (p_ids) and u.email is not null
$$;

revoke execute on function public.correos_de_usuarios(uuid[]) from anon, authenticated, public;
grant execute on function public.correos_de_usuarios(uuid[]) to service_role;
