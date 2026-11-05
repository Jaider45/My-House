-- Velocidad: el hogar, el miembro y el rol viajan en el JWT (custom access token hook). Las páginas arman el
-- contexto sin consultar la base. Es solo para la interfaz: la autorización sigue siendo RLS.
create function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ctx jsonb;
begin
  select jsonb_build_object(
           'miembro_id', m.id, 'miembro_nombre', m.nombre, 'rol', m.rol,
           'hogar_id', h.id, 'hogar_nombre', h.nombre, 'pais', h.pais, 'moneda', h.moneda,
           'cuota_imprevistos_pct', coalesce((h.config ->> 'cuota_imprevistos_pct')::int, 10))
    into ctx
    from public.members m
    join public.households h on h.id = m.household_id
   where m.user_id = (event ->> 'user_id')::uuid
   order by m.created_at
   limit 1;

  if ctx is null then
    return jsonb_set(event, '{claims}', (event -> 'claims') - 'hogar');
  end if;
  return jsonb_set(event, '{claims,hogar}', ctx);
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
