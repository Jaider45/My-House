-- Equipo y permisos → «Ingreso solo desde IP permitidas». La lista vive en plataforma_config (la lee el proxy, sin
-- sesión, con caché de 60 s). Al encenderla, la IP de quien guarda tiene que estar dentro (para no quedar por fuera).
-- Limita el uso de la consola por la app; quien llame a la API de Supabase directo con un token del equipo no pasa
-- por el proxy (las funciones siguen exigiendo AAL2 y permiso).
insert into public.plataforma_config (clave, valor) values ('consola_ips', '{"activo": false, "ips": []}') on conflict (clave) do nothing;

create function public.consola_guardar_ips(p_activo boolean, p_ips text[], p_ip_actual text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('equipo');
  r text;
  limpias text[] := '{}';
begin
  foreach r in array coalesce(p_ips, '{}') loop
    r := btrim(r);
    continue when r = '';
    begin
      perform r::cidr;
    exception when others then
      raise exception 'IP o rango no válido: %', r;
    end;
    limpias := limpias || r;
  end loop;
  if cardinality(limpias) > 50 then
    raise exception 'Máximo 50 reglas.';
  end if;
  if p_activo and cardinality(limpias) = 0 then
    raise exception 'Agrega al menos una IP antes de encender la regla.';
  end if;
  if p_activo and not exists (select 1 from unnest(limpias) x where nullif(p_ip_actual, '')::inet <<= x::cidr) then
    raise exception 'Tu IP actual (%) no está en la lista: te quedarías por fuera.', coalesce(nullif(p_ip_actual, ''), 'desconocida');
  end if;
  update public.plataforma_config set valor = jsonb_build_object('activo', coalesce(p_activo, false), 'ips', to_jsonb(limpias)), updated_at = now()
   where clave = 'consola_ips';
  perform private.auditar(s.user_id, s.nombre, 'edito_ips_consola', 'ajuste', 'consola_ips', 'IP permitidas',
                          jsonb_build_object('activo', p_activo, 'ips', to_jsonb(limpias)));
end $$;
revoke execute on function public.consola_guardar_ips(boolean, text[], text) from public, anon;
grant execute on function public.consola_guardar_ips(boolean, text[], text) to authenticated;
