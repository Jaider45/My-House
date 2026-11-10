-- Roadmap SaaS S2: planes con límites que la base hace cumplir, prueba de Familia, hogares suspendidos y las
-- pantallas de la consola Hogares, Detalle de hogar, Usuarios y Planes.
--
-- Límites (planes.limites, jsonb):
--   personas           cuentas con acceso al hogar (miembros con usuario + invitaciones vigentes)
--   comprobantes_mes   lecturas con IA al mes (null = ilimitadas; el tope técnico por hora/día sigue)
--   almacenamiento_mb  soportes en Storage
--   metas              metas de ahorro y pronóstico de cierre
--   renta_reporte      reporte anual para el contador (cuando exista)
--   whatsapp           registro por WhatsApp (cuando exista)
--   hogares, comision_pct, panel_clientes, descarga_masiva, recordatorios_masivos   plan Contador (fase S5)
-- Los límites aplican a las personas (auth.uid() no nulo); los scripts con service_role no se frenan.

-- Matriz con el permiso nuevo `usuarios` (Superadmin y Soporte).
create or replace function private.permisos_de_rol(r public.rol_staff) returns public.permiso_staff[]
language sql immutable set search_path = '' as $$
  select case r
    when 'superadmin' then enum_range(null::public.permiso_staff)
    when 'soporte'    then array['ver_hogares', 'ver_finanzas', 'usuarios', 'tickets']::public.permiso_staff[]
    when 'finanzas'   then array['ver_hogares', 'cobros', 'planes', 'exportar']::public.permiso_staff[]
    when 'contenido'  then array['ver_hogares', 'tickets', 'parametros', 'campanas']::public.permiso_staff[]
  end
$$;

-- ───────────────────────────── planes ─────────────────────────────

create table public.planes (
  codigo         text primary key check (codigo ~ '^[a-z][a-z_]{1,30}$'),
  nombre         text not null check (length(btrim(nombre)) between 1 and 40),
  descripcion    text not null default '',
  para           text not null default 'hogar' check (para in ('hogar', 'contador')),
  precio_mensual bigint not null check (precio_mensual >= 0),
  precio_anual   bigint not null check (precio_anual >= 0),
  limites        jsonb not null default '{}'::jsonb,
  orden          int not null default 0,
  publicado      boolean not null default true,
  updated_at     timestamptz not null default now()
);
comment on table public.planes is 'Planes del SaaS. Precios en pesos con IVA incluido. Se editan desde la consola (Planes y cupones).';

insert into public.planes (codigo, nombre, descripcion, para, precio_mensual, precio_anual, limites, orden) values
  ('gratis', 'Gratis', 'Para empezar a ordenar la casa', 'hogar', 0, 0,
   '{"personas": 2, "comprobantes_mes": 5, "almacenamiento_mb": 200, "metas": false, "renta_reporte": false, "whatsapp": false}', 1),
  ('familia', 'Familia', 'Todo para la casa y la renta', 'hogar', 19900, 199000,
   '{"personas": 5, "comprobantes_mes": null, "almacenamiento_mb": 2048, "metas": true, "renta_reporte": true, "whatsapp": true}', 2),
  ('contador', 'Contador', 'Panel con los hogares de tus clientes', 'contador', 99000, 990000,
   '{"hogares": 30, "personas": 3, "almacenamiento_mb": 20480, "comision_pct": 20, "panel_clientes": true, "descarga_masiva": true, "recordatorios_masivos": true}', 3);

alter table public.planes enable row level security;
-- Precios públicos: cualquiera ve los planes publicados (la página de planes del hogar y, después, la landing).
create policy planes_publicados on public.planes for select to anon, authenticated using (publicado);
-- Un plan despublicado sigue rigiendo para quien ya lo tiene: cada hogar ve el suyo.
create policy planes_del_hogar on public.planes for select to authenticated
  using (codigo in (select hh.plan from public.households hh where hh.id in (select private.mis_hogares())));
revoke insert, update, delete, truncate on public.planes from anon, authenticated;

-- Configuración de la plataforma (reglas de cobro). Lectura pública, escritura desde la consola.
create table public.plataforma_config (
  clave      text primary key,
  valor      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.plataforma_config (clave, valor) values
  ('prueba_dias', '14'),
  ('descuento_anual_visible', 'true'),
  ('iva_incluido', 'true');
alter table public.plataforma_config enable row level security;
create policy config_lectura on public.plataforma_config for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.plataforma_config from anon, authenticated;

-- ───────────────────────────── hogares ─────────────────────────────

alter table public.households
  add constraint households_plan_fk foreign key (plan) references public.planes (codigo),
  add column estado text not null default 'activo' check (estado in ('activo', 'suspendido')),
  add column suspendido_motivo text,
  add column prueba_hasta timestamptz,
  add column prueba_usada boolean not null default false;

-- El plan solo lo cambian el cobro y la consola: un admin del hogar no puede ponerse Familia con un update.
create function private.proteger_plan() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and current_user = 'authenticated' and (
       new.plan is distinct from old.plan or new.estado is distinct from old.estado
       or new.suspendido_motivo is distinct from old.suspendido_motivo
       or new.prueba_hasta is distinct from old.prueba_hasta or new.prueba_usada is distinct from old.prueba_usada) then
    raise exception 'El plan del hogar no se cambia desde aquí.';
  end if;
  return new;
end $$;
create trigger households_proteger_plan before update on public.households
  for each row execute function private.proteger_plan();

create table public.hogar_notas (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households on delete cascade,
  autor        uuid references auth.users (id) on delete set null,
  autor_nombre text not null,
  texto        text not null check (length(btrim(texto)) between 1 and 2000),
  creada       timestamptz not null default now()
);
create index hogar_notas_hogar on public.hogar_notas (household_id, creada desc);
alter table public.hogar_notas enable row level security;
revoke all on public.hogar_notas from anon, authenticated;
comment on table public.hogar_notas is 'Notas internas del equipo sobre un hogar (consola). El hogar no las ve.';

-- Hogar suspendido = solo lectura: tiene_rol es la puerta de toda escritura (políticas y funciones).
create or replace function private.tiene_rol(h uuid, roles public.rol_miembro[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
      join public.households hh on hh.id = m.household_id
     where m.household_id = h and m.user_id = (select auth.uid()) and m.rol = any (roles) and hh.estado = 'activo'
  )
$$;

-- ───────────────────────────── límites ─────────────────────────────

create function private.plan_efectivo(h uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when hh.plan = 'gratis' and hh.prueba_hasta > now() then 'familia' else hh.plan end
    from public.households hh where hh.id = h
$$;

create function private.limite(h uuid, clave text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select p.limites -> clave from public.planes p where p.codigo = private.plan_efectivo(h)
$$;

-- Lectores tipados: null en el jsonb (p. ej. comprobantes ilimitados) o clave ausente → null, sin errores de cast.
create function private.limite_num(h uuid, clave text) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric end from (select private.limite(h, clave) v) x
$$;

create function private.limite_bool(h uuid, clave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when jsonb_typeof(v) = 'boolean' then (v #>> '{}')::boolean else false end from (select private.limite(h, clave) v) x
$$;

create function private.nombre_plan(h uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.nombre from public.planes p where p.codigo = private.plan_efectivo(h)
$$;

create function private.inicio_mes_bogota() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
$$;

create function private.personas_ocupadas(h uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.members where household_id = h and user_id is not null)::int
       + (select count(*) from public.invitations
           where household_id = h and aceptada_en is null and expira_en > now())::int
$$;

create function private.comprobantes_mes(h uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.ia_usos where household_id = h and creado_en >= private.inicio_mes_bogota()
$$;

create function private.almacenamiento_mb(h uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select round(coalesce(sum((o.metadata ->> 'size')::bigint), 0) / 1048576.0, 1)
    from storage.objects o
   where o.bucket_id = 'soportes' and o.name like h::text || '/%'
$$;

create function private.cabe_en_almacenamiento(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is null
      or coalesce(private.almacenamiento_mb(h) < private.limite_num(h, 'almacenamiento_mb'), true)
$$;
grant execute on function private.cabe_en_almacenamiento(uuid) to authenticated;

-- Personas: al invitar se cuenta lo ocupado (miembros + invitaciones vigentes); al entrar alguien, los miembros.
create function private.limite_personas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tope int;
  ocupadas int;
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  tope := private.limite_num(new.household_id, 'personas')::int;
  if tope is null then
    return new;
  end if;
  if tg_table_name = 'invitations' then
    ocupadas := private.personas_ocupadas(new.household_id);
  elsif new.user_id is not null then
    select count(*) into ocupadas from public.members where household_id = new.household_id and user_id is not null;
  else
    return new; -- dependientes sin acceso: no cuentan
  end if;
  if ocupadas >= tope then
    raise exception 'Tu plan % permite % personas con acceso. Mejora tu plan para sumar a alguien más.',
      private.nombre_plan(new.household_id), tope;
  end if;
  return new;
end $$;
create trigger invitations_limite before insert on public.invitations
  for each row execute function private.limite_personas();
create trigger members_limite before insert on public.members
  for each row execute function private.limite_personas();

-- Metas de ahorro (y el pronóstico, en la interfaz) según el plan.
create function private.limite_metas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'meta' and (select auth.uid()) is not null
     and not private.limite_bool(new.household_id, 'metas') then
    raise exception 'Las metas de ahorro son del plan Familia. Mejora tu plan para crearlas.';
  end if;
  return new;
end $$;
create trigger budgets_goals_limite before insert on public.budgets_goals
  for each row execute function private.limite_metas();

-- Soportes: no se sube nada si el hogar llegó a su almacenamiento.
drop policy soportes_insert on storage.objects;
create policy soportes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'soportes'
              and private.tiene_rol(private.hogar_de_ruta(name), '{admin,editor}')
              and private.cabe_en_almacenamiento(private.hogar_de_ruta(name)));

-- Lecturas con IA: tope técnico por hora y día (contra abusos) + lecturas del mes según el plan.
create or replace function public.reservar_uso_ia(p_hogar uuid, p_tipo text, p_cantidad int default 1) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  por_hora constant int := 30;   -- lecturas por persona por hora
  por_dia  constant int := 150;  -- lecturas por hogar por día
  usadas_hora int;
  usadas_dia  int;
  del_mes     int;
  tope_mes    int;
begin
  if auth.uid() is null or not private.tiene_rol(p_hogar, '{admin,editor}') then
    raise exception 'Tu rol es de solo lectura.' using errcode = '42501';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 10 then
    raise exception 'Cantidad inválida.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ia_usos:' || p_hogar::text, 0));

  select count(*) filter (where user_id = auth.uid() and creado_en > now() - interval '1 hour'),
         count(*)
    into usadas_hora, usadas_dia
    from public.ia_usos
   where household_id = p_hogar and creado_en > now() - interval '1 day';

  if usadas_hora + p_cantidad > por_hora then
    raise exception 'Llegaste al límite de % lecturas con IA por hora. Espera un rato y vuelve a intentarlo.', por_hora;
  end if;
  if usadas_dia + p_cantidad > por_dia then
    raise exception 'Tu hogar llegó al límite de % lecturas con IA por día. Vuelve a intentarlo mañana.', por_dia;
  end if;

  tope_mes := private.limite_num(p_hogar, 'comprobantes_mes')::int;
  if tope_mes is not null then
    del_mes := private.comprobantes_mes(p_hogar);
    if del_mes + p_cantidad > tope_mes then
      raise exception 'Usaste las % lecturas con IA del plan % este mes. Mejora tu plan para seguir leyendo comprobantes.',
        tope_mes, private.nombre_plan(p_hogar);
    end if;
  end if;

  insert into public.ia_usos (household_id, user_id, tipo)
  select p_hogar, auth.uid(), p_tipo from generate_series(1, p_cantidad);
end $$;

-- ───────────────────────────── lado del hogar ─────────────────────────────

-- Plan, prueba y uso del hogar (Configuración → Plan). Cualquier miembro lo ve.
create function public.mi_plan(p_hogar uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hh public.households;
begin
  if p_hogar not in (select private.mis_hogares()) then
    raise exception 'No perteneces a ese hogar.';
  end if;
  select * into hh from public.households where id = p_hogar;
  return jsonb_build_object(
    'plan', hh.plan,
    'efectivo', private.plan_efectivo(p_hogar),
    'estado', hh.estado,
    'prueba_hasta', hh.prueba_hasta,
    'prueba_usada', hh.prueba_usada,
    'uso', jsonb_build_object(
      'personas', private.personas_ocupadas(p_hogar),
      'comprobantes_mes', private.comprobantes_mes(p_hogar),
      'almacenamiento_mb', private.almacenamiento_mb(p_hogar)));
end $$;
revoke execute on function public.mi_plan(uuid) from anon, public;
grant execute on function public.mi_plan(uuid) to authenticated;

-- Prueba de Familia sin tarjeta, una vez por hogar. Al terminar vuelve sola a Gratis (plan_efectivo).
create function public.iniciar_prueba(p_hogar uuid) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  dias int := coalesce((select (valor #>> '{}')::int from public.plataforma_config where clave = 'prueba_dias'), 14);
  hasta timestamptz := now() + make_interval(days => dias);
  hh public.households;
begin
  if not private.tiene_rol(p_hogar, '{admin}') then
    raise exception 'Solo un administrador puede activar la prueba.';
  end if;
  select * into hh from public.households where id = p_hogar for update;
  if hh.prueba_usada then
    raise exception 'Este hogar ya usó su prueba de Familia.';
  end if;
  if hh.plan <> 'gratis' then
    raise exception 'Tu hogar ya tiene un plan pago.';
  end if;
  update public.households set prueba_hasta = hasta, prueba_usada = true where id = p_hogar;
  return hasta;
end $$;
revoke execute on function public.iniciar_prueba(uuid) from anon, public;
grant execute on function public.iniciar_prueba(uuid) to authenticated;

-- El JWT dice si el hogar está suspendido (aviso en la app sin consultar la base).
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
   where m.user_id = uid
   order by m.created_at
   limit 1;
  claims := case when ctx is null then claims - 'hogar' else jsonb_set(claims, '{hogar}', ctx) end;

  select jsonb_build_object('rol', p.rol, 'nombre', p.nombre) into staff
    from public.platform_staff p where p.user_id = uid and p.activo;
  claims := case when staff is null then claims - 'staff' else jsonb_set(claims, '{staff}', staff) end;

  return jsonb_set(event, '{claims}', claims);
end $$;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- ───────────────────────────── consola: hogares ─────────────────────────────

-- MRR de un hogar en pesos (la fase S3 lo reemplaza con el de su suscripción).
create function private.mrr_hogar(h uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select 0::bigint
$$;

create function private.fila_hogar(hh public.households)
returns table (id uuid, nombre text, admin_nombre text, plan text, plan_efectivo text, miembros int,
               movimientos_30d int, mrr bigint, estado text, en_prueba boolean, ultimo_uso timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select hh.id, hh.nombre,
         (select m.nombre from public.members m where m.household_id = hh.id and m.rol = 'admin' order by m.created_at limit 1),
         hh.plan, private.plan_efectivo(hh.id),
         (select count(*)::int from public.members m where m.household_id = hh.id and m.user_id is not null),
         (select count(*)::int from public.transactions t where t.household_id = hh.id and t.created_at > now() - interval '30 days'),
         private.mrr_hogar(hh.id),
         hh.estado,
         hh.plan = 'gratis' and hh.prueba_hasta > now(),
         (select max(u.last_sign_in_at) from public.members m join auth.users u on u.id = m.user_id where m.household_id = hh.id),
         hh.created_at
$$;

create function private.hogar_cumple_filtro(hh public.households, filtro text) returns boolean
language sql stable set search_path = '' as $$
  select case coalesce(filtro, 'todos')
    when 'todos' then true
    when 'gratis' then hh.plan = 'gratis' and not coalesce(hh.prueba_hasta > now(), false)
    when 'prueba' then hh.plan = 'gratis' and coalesce(hh.prueba_hasta > now(), false)
    when 'suspendidos' then hh.estado = 'suspendido'
    else hh.plan = filtro
  end
$$;

create function private.hogar_cumple_busqueda(hh public.households, q text) returns boolean
language sql stable security definer set search_path = '' as $$
  select q is null or btrim(q) = ''
      or hh.nombre ilike '%' || btrim(q) || '%'
      or hh.id::text = btrim(q)
      or exists (select 1 from public.members m left join auth.users u on u.id = m.user_id
                  where m.household_id = hh.id and (m.nombre ilike '%' || btrim(q) || '%' or u.email ilike '%' || btrim(q) || '%'))
$$;

-- Lista paginada (cursor = created_at del último de la página anterior).
create function public.consola_hogares(p_buscar text default null, p_filtro text default 'todos',
                                       p_antes timestamptz default null, p_limite int default 25)
returns table (id uuid, nombre text, admin_nombre text, plan text, plan_efectivo text, miembros int,
               movimientos_30d int, mrr bigint, estado text, en_prueba boolean, ultimo_uso timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return query
    select f.* from public.households hh
     cross join lateral private.fila_hogar(hh) f
     where private.hogar_cumple_filtro(hh, p_filtro)
       and private.hogar_cumple_busqueda(hh, p_buscar)
       and (p_antes is null or hh.created_at < p_antes)
     order by hh.created_at desc
     limit least(greatest(coalesce(p_limite, 25), 1), 100);
end $$;

create function public.consola_hogares_conteos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return (
    select jsonb_build_object(
      'todos', count(*),
      'familia', count(*) filter (where plan = 'familia'),
      'contador', count(*) filter (where plan = 'contador'),
      'gratis', count(*) filter (where plan = 'gratis' and not coalesce(prueba_hasta > now(), false)),
      'prueba', count(*) filter (where plan = 'gratis' and coalesce(prueba_hasta > now(), false)),
      'suspendidos', count(*) filter (where estado = 'suspendido'))
    from public.households);
end $$;

-- Detalle de un hogar: datos, uso frente a su plan, miembros (correo enmascarado), notas e historial. Sin finanzas.
create function public.consola_hogar(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hh public.households;
begin
  perform private.exigir_staff('ver_hogares');
  select * into hh from public.households where id = p_id;
  if hh.id is null then
    raise exception 'No encontramos ese hogar.';
  end if;
  return jsonb_build_object(
    'hogar', (select to_jsonb(f) from private.fila_hogar(hh) f),
    'pais', hh.pais,
    'suspendido_motivo', hh.suspendido_motivo,
    'prueba_hasta', hh.prueba_hasta,
    'prueba_usada', hh.prueba_usada,
    'limites', (select p.limites from public.planes p where p.codigo = private.plan_efectivo(hh.id)),
    'uso', jsonb_build_object(
      'personas', private.personas_ocupadas(hh.id),
      'comprobantes_mes', private.comprobantes_mes(hh.id),
      'almacenamiento_mb', private.almacenamiento_mb(hh.id)),
    'miembros', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre', m.nombre, 'rol', m.rol, 'dependiente', m.user_id is null,
               'email', private.enmascarar_correo(u.email::text),
               'dos_pasos', exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified'),
               'ultimo_ingreso', u.last_sign_in_at) order by m.user_id is null, m.created_at)
        from public.members m left join auth.users u on u.id = m.user_id
       where m.household_id = hh.id), '[]'::jsonb),
    'invitaciones', coalesce((
      select jsonb_agg(jsonb_build_object('email', private.enmascarar_correo(i.email), 'rol', i.rol, 'expira_en', i.expira_en))
        from public.invitations i where i.household_id = hh.id and i.aceptada_en is null and i.expira_en > now()), '[]'::jsonb),
    'notas', coalesce((
      select jsonb_agg(jsonb_build_object('autor', n.autor_nombre, 'texto', n.texto, 'creada', n.creada) order by n.creada desc)
        from public.hogar_notas n where n.household_id = hh.id), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(jsonb_build_object('quien', a.quien_nombre, 'accion', a.accion, 'objeto_nombre', a.objeto_nombre,
                                          'detalle', a.detalle, 'creada', a.creada) order by a.id desc)
        from (select * from public.auditoria a where a.objeto_tipo = 'hogar' and a.objeto_id = hh.id::text
               order by a.id desc limit 30) a), '[]'::jsonb));
end $$;

create function public.consola_cambiar_plan(p_id uuid, p_plan text, p_motivo text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  hh public.households;
begin
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escribe el motivo del cambio.';
  end if;
  if not exists (select 1 from public.planes where codigo = p_plan) then
    raise exception 'Ese plan no existe.';
  end if;
  select * into hh from public.households where id = p_id for update;
  if hh.id is null then
    raise exception 'No encontramos ese hogar.';
  end if;
  if hh.plan = p_plan then
    return;
  end if;
  update public.households set plan = p_plan where id = p_id;
  perform private.auditar(s.user_id, s.nombre, 'cambio_plan', 'hogar', p_id::text, hh.nombre,
                          jsonb_build_object('antes', hh.plan, 'despues', p_plan, 'motivo', btrim(p_motivo)));
end $$;

create function public.consola_suspender(p_id uuid, p_suspender boolean, p_motivo text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  hh public.households;
begin
  if p_suspender and length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escribe el motivo de la suspensión.';
  end if;
  select * into hh from public.households where id = p_id for update;
  if hh.id is null then
    raise exception 'No encontramos ese hogar.';
  end if;
  if (hh.estado = 'suspendido') = p_suspender then
    return;
  end if;
  update public.households
     set estado = case when p_suspender then 'suspendido' else 'activo' end,
         suspendido_motivo = case when p_suspender then btrim(p_motivo) end
   where id = p_id;
  perform private.auditar(s.user_id, s.nombre, case when p_suspender then 'suspendio_hogar' else 'reactivo_hogar' end,
                          'hogar', p_id::text, hh.nombre, jsonb_build_object('motivo', nullif(btrim(coalesce(p_motivo, '')), '')));
end $$;

create function public.consola_nota_hogar(p_id uuid, p_texto text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('ver_hogares');
begin
  if not exists (select 1 from public.households where id = p_id) then
    raise exception 'No encontramos ese hogar.';
  end if;
  insert into public.hogar_notas (household_id, autor, autor_nombre, texto) values (p_id, s.user_id, s.nombre, btrim(p_texto));
end $$;

-- ───────────────────────────── consola: usuarios ─────────────────────────────

create function private.fila_usuario(u auth.users)
returns table (user_id uuid, nombre text, email text, hogar_id uuid, hogar text, rol public.rol_miembro, dos_pasos boolean,
               ultimo_ingreso timestamptz, created_at timestamptz, es_equipo boolean)
language sql stable security definer set search_path = '' as $$
  select u.id,
         coalesce(m.nombre, u.raw_user_meta_data ->> 'nombre', split_part(u.email::text, '@', 1)),
         private.enmascarar_correo(u.email::text),
         m.household_id, hh.nombre, m.rol,
         exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
         u.last_sign_in_at, u.created_at,
         exists (select 1 from public.platform_staff p where p.user_id = u.id and p.activo)
    from (select 1) _
    left join lateral (select * from public.members m where m.user_id = u.id order by m.created_at limit 1) m on true
    left join public.households hh on hh.id = m.household_id
$$;

create function public.consola_usuarios(p_buscar text default null, p_filtro text default 'todos',
                                        p_antes timestamptz default null, p_limite int default 25)
returns table (user_id uuid, nombre text, email text, hogar_id uuid, hogar text, rol public.rol_miembro, dos_pasos boolean,
               ultimo_ingreso timestamptz, created_at timestamptz, es_equipo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return query
    select f.* from auth.users u
     cross join lateral private.fila_usuario(u) f
     where (p_antes is null or u.created_at < p_antes)
       and (p_buscar is null or btrim(p_buscar) = '' or u.email ilike '%' || btrim(p_buscar) || '%'
            or f.nombre ilike '%' || btrim(p_buscar) || '%')
       and case coalesce(p_filtro, 'todos')
             when 'admin' then f.rol = 'admin'
             when 'editor' then f.rol = 'editor'
             when 'contador' then f.rol = 'contador'
             when 'sin_2fa' then not f.dos_pasos
             when 'equipo' then f.es_equipo
             else true end
     order by u.created_at desc
     limit least(greatest(coalesce(p_limite, 25), 1), 100);
end $$;

create function public.consola_usuarios_conteos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return (
    select jsonb_build_object(
      'todos', count(*),
      'admin', count(*) filter (where f.rol = 'admin'),
      'editor', count(*) filter (where f.rol = 'editor'),
      'contador', count(*) filter (where f.rol = 'contador'),
      'sin_2fa', count(*) filter (where not f.dos_pasos),
      'equipo', count(*) filter (where f.es_equipo))
    from auth.users u cross join lateral private.fila_usuario(u) f);
end $$;

-- Ver un correo completo queda en la auditoría (los listados lo muestran enmascarado).
create function public.consola_ver_correo(p_user uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('ver_hogares');
  correo text;
  nombre text;
begin
  select u.email::text, f.nombre into correo, nombre from auth.users u cross join lateral private.fila_usuario(u) f where u.id = p_user;
  if correo is null then
    raise exception 'No encontramos esa cuenta.';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'vio_correo', 'usuario', p_user::text, nombre);
  return correo;
end $$;

-- Cierra todas las sesiones de la cuenta (el token de acceso vigente dura hasta 1 hora).
create function public.consola_cerrar_sesiones(p_user uuid) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('usuarios');
  nombre text;
  n int;
begin
  select f.nombre into nombre from auth.users u cross join lateral private.fila_usuario(u) f where u.id = p_user;
  if nombre is null then
    raise exception 'No encontramos esa cuenta.';
  end if;
  delete from auth.sessions where user_id = p_user;
  get diagnostics n = row_count;
  perform private.auditar(s.user_id, s.nombre, 'cerro_sesiones', 'usuario', p_user::text, nombre, jsonb_build_object('sesiones', n));
  return n;
end $$;

-- Quita la verificación en dos pasos (la persona perdió el celular) y cierra sus sesiones.
create function public.consola_restablecer_2fa(p_user uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('usuarios');
  nombre text;
begin
  if p_user = s.user_id then
    raise exception 'No puedes restablecer tu propia verificación desde aquí.';
  end if;
  select f.nombre into nombre from auth.users u cross join lateral private.fila_usuario(u) f where u.id = p_user;
  if nombre is null then
    raise exception 'No encontramos esa cuenta.';
  end if;
  delete from auth.mfa_factors where user_id = p_user;
  delete from auth.sessions where user_id = p_user;
  perform private.auditar(s.user_id, s.nombre, 'restablecio_2fa', 'usuario', p_user::text, nombre);
end $$;

-- ───────────────────────────── consola: planes ─────────────────────────────

create function public.consola_planes() returns setof public.planes
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return query select * from public.planes order by orden, codigo;
end $$;

create function public.consola_guardar_plan(p_codigo text, p_nombre text, p_mensual bigint, p_anual bigint,
                                            p_limites jsonb, p_publicado boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('planes');
  antes public.planes;
begin
  select * into antes from public.planes where codigo = p_codigo for update;
  if antes.codigo is null then
    raise exception 'Ese plan no existe.';
  end if;
  if p_mensual < 0 or p_anual < 0 then
    raise exception 'Los precios no pueden ser negativos.';
  end if;
  if jsonb_typeof(p_limites) <> 'object' then
    raise exception 'Límites no válidos.';
  end if;
  if p_codigo = 'gratis' and (p_mensual <> 0 or p_anual <> 0 or not p_publicado) then
    raise exception 'El plan Gratis siempre es gratis y está publicado.';
  end if;
  update public.planes
     set nombre = btrim(p_nombre), precio_mensual = p_mensual, precio_anual = p_anual,
         limites = p_limites, publicado = p_publicado, updated_at = now()
   where codigo = p_codigo;
  perform private.auditar(s.user_id, s.nombre, 'edito_plan', 'plan', p_codigo, btrim(p_nombre),
    jsonb_build_object(
      'antes', jsonb_build_object('mensual', antes.precio_mensual, 'anual', antes.precio_anual, 'limites', antes.limites, 'publicado', antes.publicado),
      'despues', jsonb_build_object('mensual', p_mensual, 'anual', p_anual, 'limites', p_limites, 'publicado', p_publicado)));
end $$;

create function public.consola_guardar_config(p_clave text, p_valor jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('planes');
  antes jsonb;
begin
  select valor into antes from public.plataforma_config where clave = p_clave for update;
  if antes is null then
    raise exception 'Esa regla no existe.';
  end if;
  if p_clave = 'prueba_dias' and (jsonb_typeof(p_valor) <> 'number' or (p_valor #>> '{}')::int not between 0 and 60) then
    raise exception 'La prueba dura entre 0 y 60 días.';
  end if;
  if p_clave in ('descuento_anual_visible', 'iva_incluido') and jsonb_typeof(p_valor) <> 'boolean' then
    raise exception 'Valor no válido.';
  end if;
  update public.plataforma_config set valor = p_valor, updated_at = now() where clave = p_clave;
  perform private.auditar(s.user_id, s.nombre, 'edito_regla', 'regla', p_clave, p_clave,
                          jsonb_build_object('antes', antes, 'despues', p_valor));
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'consola_hogares(text, text, timestamptz, int)', 'consola_hogares_conteos()', 'consola_hogar(uuid)',
    'consola_cambiar_plan(uuid, text, text)', 'consola_suspender(uuid, boolean, text)', 'consola_nota_hogar(uuid, text)',
    'consola_usuarios(text, text, timestamptz, int)', 'consola_usuarios_conteos()', 'consola_ver_correo(uuid)',
    'consola_cerrar_sesiones(uuid)', 'consola_restablecer_2fa(uuid)', 'consola_planes()',
    'consola_guardar_plan(text, text, bigint, bigint, jsonb, boolean)', 'consola_guardar_config(text, jsonb)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
