-- 1) El JWT dice si la persona tiene verificación en dos pasos (claim `mfa_activa`). Así el proxy decide si exige
--    AAL2 leyendo el token, sin consultar a Auth en cada request.
-- 2) Clave de idempotencia en movimientos: un registro hecho sin conexión que se reenvía no se duplica.
-- 3) Verificar la contraseña actual (Configuración → Seguridad) sin abrir otra sesión ni pasar por el captcha.

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ctx jsonb;
  claims jsonb := event -> 'claims';
begin
  claims := jsonb_set(claims, '{mfa_activa}', to_jsonb(exists (
    select 1 from auth.mfa_factors f where f.user_id = (event ->> 'user_id')::uuid and f.status = 'verified')));

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

  claims := case when ctx is null then claims - 'hogar' else jsonb_set(claims, '{hogar}', ctx) end;
  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

alter table public.transactions add column client_id uuid;
alter table public.transactions add constraint transactions_client_id_unico unique (household_id, client_id);
comment on column public.transactions.client_id is
  'Clave que genera el dispositivo al registrar; si el mismo registro llega dos veces (cola sin conexión), el segundo se rechaza.';

-- Devuelve si la contraseña es la de quien llama. Con pausa ante un fallo para frenar la adivinación por fuerza bruta.
create function public.verificar_contrasena_actual(clave text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  correcta boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  select u.encrypted_password = extensions.crypt(clave, u.encrypted_password)
    into correcta
    from auth.users u
   where u.id = auth.uid();
  if not coalesce(correcta, false) then
    perform pg_sleep(1);
  end if;
  return coalesce(correcta, false);
end $$;

revoke execute on function public.verificar_contrasena_actual(text) from anon, public;
grant execute on function public.verificar_contrasena_actual(text) to authenticated;
