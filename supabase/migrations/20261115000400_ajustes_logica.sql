-- Ajustes de la plataforma con efecto en la app: tamaño de los comprobantes, 2FA obligatoria para administradores
-- de hogar (claim `exigir_2fa` que lee el proxy) y bloqueo temporal tras intentos fallidos de ingreso.

-- El tope del bucket sube a 25 MB; el ajuste `comprobante_mb` decide el tope real (1–25).
update storage.buckets set file_size_limit = 26214400 where id = 'soportes';
update public.plataforma_config set valor = jsonb_set(valor, '{comprobante_mb}', '10') where clave = 'limites_app' and (valor ->> 'comprobante_mb')::int > 25;

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ctx jsonb;
  staff jsonb;
  uid uuid := (event ->> 'user_id')::uuid;
  claims jsonb := event -> 'claims';
begin
  claims := jsonb_set(claims, '{mfa_activa}', to_jsonb(exists (
    select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified')));

  select jsonb_build_object(
           'miembro_id', m.id, 'miembro_nombre', m.nombre, 'rol', m.rol,
           'hogar_id', h.id, 'hogar_nombre', h.nombre, 'pais', h.pais, 'moneda', h.moneda,
           'cuota_imprevistos_pct', coalesce((h.config ->> 'cuota_imprevistos_pct')::int, 10),
           'suspendido', h.estado = 'suspendido')
    into ctx
    from public.members m
    join public.households h on h.id = m.household_id
   where m.user_id = uid and m.household_id = private.hogar_activo_de(uid);
  claims := case when ctx is null then claims - 'hogar' else jsonb_set(claims, '{hogar}', ctx) end;
  -- Ajustes de la plataforma → «Pedir 2FA a todos los administradores de hogar».
  claims := case when ctx ->> 'rol' = 'admin'
                      and coalesce((select (valor ->> 'exigir_2fa_admins')::boolean from public.plataforma_config where clave = 'limites_app'), false)
                 then jsonb_set(claims, '{exigir_2fa}', 'true') else claims - 'exigir_2fa' end;

  select jsonb_build_object('rol', p.rol, 'nombre', p.nombre) into staff
    from public.platform_staff p where p.user_id = uid and p.activo;
  claims := case when staff is null then claims - 'staff' else jsonb_set(claims, '{staff}', staff) end;

  return jsonb_set(event, '{claims}', claims);
end $$;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Intentos fallidos de ingreso por correo (huella sha256, sin guardar el correo). Ventana y bloqueo de 15 minutos.
create table public.intentos_ingreso (
  id         bigint generated always as identity primary key,
  huella     text not null,
  created_at timestamptz not null default now()
);
create index intentos_ingreso_idx on public.intentos_ingreso (huella, created_at desc);
alter table public.intentos_ingreso enable row level security;
revoke all on public.intentos_ingreso from anon, authenticated;

-- ¿Está bloqueado el ingreso con este correo? Minutos que faltan (0 = no).
create function public.ingreso_bloqueado(p_email text) returns int
language sql stable security definer set search_path = '' as $$
  with lim as (select coalesce((select (valor ->> 'intentos_bloqueo')::int from public.plataforma_config where clave = 'limites_app'), 5) n),
       f as (select created_at from public.intentos_ingreso
              where huella = private.huella_token(lower(btrim(p_email))) and created_at > now() - interval '15 minutes'
              order by created_at desc)
  select case when (select count(*) from f) >= (select n from lim)
              then greatest(1, ceil(extract(epoch from ((select max(created_at) from f) + interval '15 minutes' - now())) / 60)::int)
              else 0 end
$$;

create function public.registrar_ingreso(p_email text, p_ok boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_ok then
    delete from public.intentos_ingreso where huella = private.huella_token(lower(btrim(p_email)));
  else
    insert into public.intentos_ingreso (huella) values (private.huella_token(lower(btrim(p_email))));
    delete from public.intentos_ingreso where created_at < now() - interval '1 day';
  end if;
end $$;

revoke execute on function public.ingreso_bloqueado(text), public.registrar_ingreso(text, boolean) from public, anon, authenticated;
grant execute on function public.ingreso_bloqueado(text), public.registrar_ingreso(text, boolean) to service_role;
