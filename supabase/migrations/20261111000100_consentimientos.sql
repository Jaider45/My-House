-- Bases legales (SaaS S0): consentimientos de la persona (Ley 1581 de 2012 y Decreto 1074 de 2015).
-- Prueba de la autorización: quién aceptó, qué versión del texto, cuándo, desde qué IP y navegador.
-- Es un historial (solo inserciones): una versión nueva de la política o un cambio de opinión agrega filas.

create table public.consentimientos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  tipo       text not null check (tipo in ('politica_datos', 'terminos', 'comunicaciones')),
  version    text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  aceptado   boolean not null,
  origen     text not null check (origen in ('registro', 'app')),
  ip         text,
  agente     text,
  created_at timestamptz not null default now()
);
create index consentimientos_user_idx on public.consentimientos (user_id, tipo, created_at desc);

alter table public.consentimientos enable row level security;
-- Cada persona ve los suyos; nadie escribe por la API (solo las funciones de abajo).
create policy consentimientos_propios on public.consentimientos for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.consentimientos from anon, authenticated;
grant select on public.consentimientos to authenticated;

create function private.inmutable_consentimiento() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Los consentimientos no se modifican: se registra uno nuevo.';
end $$;
create trigger consentimientos_inmutables before update on public.consentimientos
  for each row execute function private.inmutable_consentimiento();

-- Registro con correo: la acción de /registro valida las casillas y manda en los metadatos
-- `consentimiento: {version, comunicaciones, ip, agente}`. Este trigger lo convierte en filas.
create function private.consentimiento_al_registrarse() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb := new.raw_user_meta_data -> 'consentimiento';
  v text := c ->> 'version';
begin
  if c is null or v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then
    return new;
  end if;
  insert into public.consentimientos (user_id, tipo, version, aceptado, origen, ip, agente)
  select new.id, t.tipo, v, t.aceptado, 'registro', left(c ->> 'ip', 64), left(c ->> 'agente', 300)
    from (values ('politica_datos', true), ('terminos', true),
                 ('comunicaciones', coalesce((c ->> 'comunicaciones')::boolean, false))) as t (tipo, aceptado);
  return new;
end $$;
create trigger consentimiento_al_registrarse after insert on auth.users
  for each row execute function private.consentimiento_al_registrarse();

-- Desde la app (cuenta creada con Google o antes de existir las casillas; versión nueva de la política).
-- La IP y el navegador llegan en `x-mh-ip` / `x-mh-agente`, como en la auditoría de la consola.
create function public.aceptar_consentimientos(p_version text, p_comunicaciones boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
  ip text := left(coalesce(private.cabecera('x-mh-ip'), btrim(split_part(private.cabecera('x-forwarded-for'), ',', 1))), 64);
  agente text := left(private.cabecera('x-mh-agente'), 300);
begin
  if yo is null then
    raise exception 'Necesitas una sesión.';
  end if;
  if p_version is null or p_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Versión de la política inválida.';
  end if;
  insert into public.consentimientos (user_id, tipo, version, aceptado, origen, ip, agente)
  values (yo, 'politica_datos', p_version, true, 'app', ip, agente),
         (yo, 'terminos', p_version, true, 'app', ip, agente),
         (yo, 'comunicaciones', p_version, coalesce(p_comunicaciones, false), 'app', ip, agente);
end $$;
revoke execute on function public.aceptar_consentimientos(text, boolean) from public, anon;
grant execute on function public.aceptar_consentimientos(text, boolean) to authenticated;
revoke execute on function private.consentimiento_al_registrarse(), private.inmutable_consentimiento() from public, anon, authenticated;

-- La exportación de Ley 1581 incluye los consentimientos del titular.
create or replace function public.consola_exportar_titular(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('auditoria');
  sol public.solicitudes_privacidad;
  hogares uuid[];
begin
  select * into sol from public.solicitudes_privacidad where id = p_id for update;
  if sol.id is null or sol.titular_user is null then
    raise exception 'La solicitud no tiene una cuenta asociada para exportar.';
  end if;
  hogares := array(select household_id from public.members where user_id = sol.titular_user);
  update public.solicitudes_privacidad set exportada_en = now(), estado = case when estado = 'recibida' then 'en_tramite' else estado end where id = sol.id;
  perform private.auditar(s.user_id, s.nombre, 'exporto_datos_titular', 'solicitud', sol.id::text, sol.titular_correo,
                          jsonb_build_object('hogares', cardinality(hogares)));
  return jsonb_build_object(
    'generado', now(),
    'titular', (select jsonb_build_object('correo', u.email, 'creado', u.created_at, 'ultimo_ingreso', u.last_sign_in_at) from auth.users u where u.id = sol.titular_user),
    'consentimientos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', c.tipo, 'version', c.version, 'aceptado', c.aceptado,
                          'origen', c.origen, 'ip', c.ip, 'fecha', c.created_at) order by c.created_at), '[]'::jsonb)
                          from public.consentimientos c where c.user_id = sol.titular_user),
    'membresias', (select coalesce(jsonb_agg(jsonb_build_object('hogar', h.nombre, 'rol', m.rol, 'nombre', m.nombre, 'desde', m.created_at)), '[]'::jsonb)
                     from public.members m join public.households h on h.id = m.household_id where m.user_id = sol.titular_user),
    'hogares', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', h.id, 'nombre', h.nombre, 'pais', h.pais, 'plan', h.plan, 'creado', h.created_at,
                  'miembros', (select jsonb_agg(jsonb_build_object('nombre', m.nombre, 'rol', m.rol, 'parentesco', m.parentesco, 'fecha_nacimiento', m.fecha_nacimiento)) from public.members m where m.household_id = h.id),
                  'cuentas', (select coalesce(jsonb_agg(to_jsonb(c) - 'household_id' - 'mapeo_csv'), '[]'::jsonb) from public.accounts c where c.household_id = h.id),
                  'categorias', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'padre_id', c.padre_id, 'clase', c.clase)), '[]'::jsonb) from public.categories c where c.household_id = h.id),
                  'movimientos', (select coalesce(jsonb_agg(to_jsonb(t) - 'household_id' - 'import_hash' order by t.fecha), '[]'::jsonb) from public.transactions t where t.household_id = h.id),
                  'pagos_fijos', (select coalesce(jsonb_agg(to_jsonb(r) - 'household_id'), '[]'::jsonb) from public.recurring_rules r where r.household_id = h.id),
                  'presupuestos_y_metas', (select coalesce(jsonb_agg(to_jsonb(b) - 'household_id'), '[]'::jsonb) from public.budgets_goals b where b.household_id = h.id),
                  'deudas', (select coalesce(jsonb_agg(to_jsonb(d) - 'household_id'), '[]'::jsonb) from public.debts d where d.household_id = h.id),
                  'recordatorios', (select coalesce(jsonb_agg(to_jsonb(r) - 'household_id'), '[]'::jsonb) from public.reminders r where r.household_id = h.id),
                  'soportes', (select coalesce(jsonb_agg(jsonb_build_object('archivo', a.archivo_path, 'tipo', a.tipo, 'movimiento', a.transaction_id)), '[]'::jsonb) from public.attachments a where a.household_id = h.id),
                  'cobros', (select coalesce(jsonb_agg(jsonb_build_object('fecha', c.creado, 'monto', c.monto, 'estado', c.estado, 'pagado_en', c.pagado_en)), '[]'::jsonb) from public.cobros c where c.household_id = h.id))), '[]'::jsonb)
                from public.households h where h.id = any (hogares)),
    'solicitudes', (select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'recibida', x.recibida, 'estado', x.estado)), '[]'::jsonb)
                      from public.solicitudes_privacidad x where x.titular_user = sol.titular_user));
end $$;
