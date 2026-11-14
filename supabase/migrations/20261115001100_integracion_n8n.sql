-- Diseño «Admin SaaS» → IA y automatizaciones: n8n como integración (dirección + llave de API, solo lectura) para
-- listar los flujos, su última ejecución y su tasa de éxito.
alter table public.integraciones drop constraint integraciones_proveedor_check;
alter table public.integraciones add constraint integraciones_proveedor_check
  check (proveedor in ('resend', 'wompi', 'whatsapp', 'anthropic', 'openai', 'n8n'));

create or replace function private.campos_integracion(p text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p
    when 'resend'    then '{"config": ["remitente"], "secretos": ["api_key"]}'
    when 'wompi'     then '{"config": ["llave_publica"], "secretos": ["integridad", "eventos", "privada"]}'
    when 'whatsapp'  then '{"config": ["phone_number_id", "waba_id", "verify_token"], "secretos": ["token", "app_secret"]}'
    when 'anthropic' then '{"config": ["modelo"], "secretos": ["api_key"]}'
    when 'openai'    then '{"config": ["modelo"], "secretos": ["api_key"]}'
    when 'n8n'       then '{"config": ["url"], "secretos": ["api_key"]}'
  end::jsonb
$$;
