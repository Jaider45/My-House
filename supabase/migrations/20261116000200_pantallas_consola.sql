-- Pantallas de la consola comparadas con el diseño (2026-11-16): Usuarios (bloqueados, desbloquear, contadores con
-- cuántos hogares atienden), Contadores (solicitudes de verificación, pagar comisiones del mes, conversión frente a
-- los demás canales), Soporte (ticket creado por el equipo con su canal, mediana de primera respuesta), Analítica
-- (periodo, tiempo de registro, cómo registran, inversión por canal y CAC), Catálogos (uso de categorías, reglas y
-- formatos), Privacidad (indicadores) y Parámetros DIAN (grupo, límite y uso de etiquetas; revisión contable).

-- ───────────────────────────── Usuarios ─────────────────────────────

-- Intentos fallidos de ingreso en la ventana de 15 minutos (el mismo cálculo de ingreso_bloqueado).
create function private.intentos_recientes(p_email text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.intentos_ingreso
   where huella = private.huella_token(lower(btrim(p_email))) and created_at > now() - interval '15 minutes'
$$;

create function private.limite_intentos() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select (valor ->> 'intentos_bloqueo')::int from public.plataforma_config where clave = 'limites_app'), 5)
$$;

create or replace function public.consola_usuarios(p_buscar text default null, p_filtro text default 'todos',
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
             when 'bloqueados' then private.intentos_recientes(u.email) >= private.limite_intentos()
             else true end
     order by u.created_at desc
     limit least(greatest(coalesce(p_limite, 25), 1), 100);
end $$;

create or replace function public.consola_usuarios_conteos() returns jsonb
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
      'equipo', count(*) filter (where f.es_equipo),
      'bloqueados', count(*) filter (where private.intentos_recientes(u.email) >= private.limite_intentos()))
    from auth.users u cross join lateral private.fila_usuario(u) f);
end $$;

-- Estado de una página de usuarios: intentos fallidos, si está bloqueado y en cuántos hogares está (contadores).
create function public.consola_usuarios_estado(p_ids uuid[]) returns table (user_id uuid, intentos int, bloqueado boolean, hogares int)
language plpgsql stable security definer set search_path = '' as $$
declare
  lim int := private.limite_intentos();
begin
  perform private.exigir_staff('ver_hogares');
  return query
    select u.id, private.intentos_recientes(u.email), private.intentos_recientes(u.email) >= lim,
           (select count(*)::int from public.members m where m.user_id = u.id)
      from auth.users u where u.id = any (p_ids[1:100]);
end $$;

create function public.consola_desbloquear(p_user uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('usuarios');
  correo text;
begin
  select email into correo from auth.users where id = p_user;
  if correo is null then
    raise exception 'Esa cuenta no existe.';
  end if;
  delete from public.intentos_ingreso where huella = private.huella_token(lower(btrim(correo)));
  perform private.auditar(s.user_id, s.nombre, 'desbloqueo_ingreso', 'usuario', p_user::text, private.enmascarar_correo(correo));
end $$;

-- ───────────────────────────── Contadores ─────────────────────────────

-- La firma pide la verificación desde su panel (Clientes) con su tarjeta profesional; el equipo aprueba o pide datos.
create table public.solicitudes_contador (
  id          uuid primary key default gen_random_uuid(),
  firma       uuid not null references public.households (id) on delete cascade,
  pedida_por  uuid references auth.users (id) on delete set null default auth.uid(),
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 120),
  ciudad      text check (char_length(ciudad) <= 60),
  tarjeta     text check (char_length(tarjeta) <= 40),
  clientes    int check (clientes between 0 and 5000),
  nota        text check (char_length(nota) <= 600),
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'datos_pedidos', 'aprobada', 'rechazada')),
  respuesta   text check (char_length(respuesta) <= 600),
  respondida_por text,
  respondida_en  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index solicitudes_contador_abierta on public.solicitudes_contador (firma) where estado in ('pendiente', 'datos_pedidos');
alter table public.solicitudes_contador enable row level security;
-- Quien administra la firma ve sus solicitudes (y la respuesta del equipo).
create policy "solicitudes_contador: la firma" on public.solicitudes_contador for select to authenticated
  using (firma in (select private.mis_hogares()) and private.tiene_rol(firma, array['admin']::public.rol_miembro[]));
revoke insert, update, delete, truncate on public.solicitudes_contador from anon, authenticated;
revoke all on public.solicitudes_contador from anon;

create function public.solicitar_verificacion_contador(p_firma uuid, p_ciudad text, p_tarjeta text, p_clientes int, p_nota text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  h public.households;
  v_id uuid;
begin
  select * into h from public.households where id = p_firma;
  if h.id is null or not private.tiene_rol(p_firma, array['admin']::public.rol_miembro[]) then
    raise exception 'Solo quien administra la firma pide la verificación.' using errcode = '42501';
  end if;
  if h.contador_verificado then
    raise exception 'Tu firma ya está verificada.';
  end if;
  if char_length(btrim(coalesce(p_tarjeta, ''))) < 3 then
    raise exception 'Escribe el número de tu tarjeta profesional.';
  end if;
  update public.solicitudes_contador set ciudad = left(btrim(p_ciudad), 60), tarjeta = left(btrim(p_tarjeta), 40), clientes = p_clientes,
         nota = left(btrim(coalesce(p_nota, '')), 600), estado = 'pendiente', created_at = now()
   where firma = p_firma and estado in ('pendiente', 'datos_pedidos') returning id into v_id;
  if v_id is null then
    insert into public.solicitudes_contador (firma, nombre, ciudad, tarjeta, clientes, nota)
    values (p_firma, h.nombre, left(btrim(p_ciudad), 60), left(btrim(p_tarjeta), 40), p_clientes, left(btrim(coalesce(p_nota, '')), 600))
    returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.consola_solicitudes_contador() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'firma', s.firma, 'nombre', s.nombre, 'ciudad', s.ciudad, 'tarjeta', s.tarjeta, 'clientes', s.clientes,
            'nota', s.nota, 'estado', s.estado, 'respuesta', s.respuesta, 'created_at', s.created_at) order by s.created_at), '[]'::jsonb)
            from public.solicitudes_contador s where s.estado in ('pendiente', 'datos_pedidos'));
end $$;

-- aprobar → firma verificada · pedir_datos → la firma ve el mensaje y vuelve a enviar · rechazar.
create function public.consola_responder_solicitud_contador(p_id uuid, p_accion text, p_mensaje text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  sol public.solicitudes_contador;
begin
  select * into sol from public.solicitudes_contador where id = p_id and estado in ('pendiente', 'datos_pedidos') for update;
  if sol.id is null then
    raise exception 'Esa solicitud ya fue respondida.';
  end if;
  if p_accion not in ('aprobar', 'pedir_datos', 'rechazar') then
    raise exception 'Acción desconocida.';
  end if;
  if p_accion <> 'aprobar' and char_length(btrim(coalesce(p_mensaje, ''))) < 5 then
    raise exception 'Escribe qué datos faltan o por qué no se aprueba.';
  end if;
  update public.solicitudes_contador
     set estado = case p_accion when 'aprobar' then 'aprobada' when 'pedir_datos' then 'datos_pedidos' else 'rechazada' end,
         respuesta = nullif(left(btrim(coalesce(p_mensaje, '')), 600), ''), respondida_por = s.nombre, respondida_en = now()
   where id = p_id;
  if p_accion = 'aprobar' then
    update public.households set contador_verificado = true where id = sol.firma;
  end if;
  perform private.auditar(s.user_id, s.nombre, 'solicitud_contador_' || p_accion, 'hogar', sol.firma::text, sol.nombre,
                          jsonb_build_object('mensaje', p_mensaje));
  return sol.pedida_por;
end $$;

-- «Pagar comisiones»: marca pagadas todas las pendientes de un mes (la transferencia se hace por fuera).
create function public.consola_pagar_comisiones(p_mes text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  n int;
  total bigint;
begin
  if p_mes !~ '^\d{4}-\d{2}$' then
    raise exception 'Elige el mes.';
  end if;
  with p as (update public.comisiones set estado = 'pagada', pagada_en = now()
              where estado = 'pendiente' and mes = (p_mes || '-01')::date returning monto)
  select count(*), coalesce(sum(monto), 0) into n, total from p;
  if n = 0 then
    raise exception 'No hay comisiones pendientes de ese mes. Liquídalo primero.';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'pago_comisiones', 'comision', p_mes, p_mes, jsonb_build_object('firmas', n, 'total', total));
  return jsonb_build_object('firmas', n, 'total', total);
end $$;

-- Conversión de los hogares que llegaron por contadores frente a los demás (para el indicador del diseño).
create function public.consola_contadores_conversion() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return (select jsonb_build_object(
            'referidos', count(*) filter (where h.referido_por is not null),
            'referidos_pagan', count(*) filter (where h.referido_por is not null and s.household_id is not null),
            'otros', count(*) filter (where h.referido_por is null and h.plan <> 'contador'),
            'otros_pagan', count(*) filter (where h.referido_por is null and h.plan <> 'contador' and s.household_id is not null))
            from public.households h left join public.suscripciones s on s.household_id = h.id and s.estado in ('activa', 'vencida'));
end $$;

-- ───────────────────────────── Soporte ─────────────────────────────

alter table public.tickets add column canal text not null default 'app' check (canal in ('app', 'correo', 'telefono', 'whatsapp'));

-- «Nuevo ticket»: lo abre el equipo por algo que llegó por correo, teléfono o WhatsApp. Si el correo es de una cuenta,
-- queda a su nombre y en su hogar (así lo ve en Ayuda y recibe las respuestas).
create function public.consola_crear_ticket(p_correo text, p_nombre text, p_asunto text, p_categoria text, p_prioridad text,
                                            p_canal text, p_mensaje text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('tickets');
  correo text := lower(btrim(coalesce(p_correo, '')));
  titular uuid;
  hogar uuid;
  nombre text;
  v_id uuid;
  prio text := coalesce(nullif(p_prioridad, ''), 'normal');
begin
  if p_canal not in ('correo', 'telefono', 'whatsapp') then
    raise exception 'Elige por dónde llegó.';
  end if;
  if prio not in ('baja', 'normal', 'alta', 'urgente') then
    raise exception 'Prioridad desconocida.';
  end if;
  if char_length(btrim(coalesce(p_asunto, ''))) not between 3 and 120 then
    raise exception 'Escribe el asunto (3 a 120 caracteres).';
  end if;
  if char_length(btrim(coalesce(p_mensaje, ''))) not between 5 and 5000 then
    raise exception 'Escribe lo que pidió la persona.';
  end if;
  if correo <> '' then
    select id into titular from auth.users where lower(email) = correo;
  end if;
  if titular is not null then
    select m.household_id, m.nombre into hogar, nombre from public.members m
     where m.user_id = titular order by (m.household_id = private.hogar_activo_de(titular)) desc, m.created_at limit 1;
  end if;
  nombre := coalesce(nullif(btrim(p_nombre), ''), nombre, nullif(correo, ''), 'Sin nombre');
  insert into public.tickets (household_id, creado_por, creado_nombre, asunto, categoria, prioridad, canal, sla_vence)
  values (hogar, titular, left(nombre, 120), btrim(p_asunto), coalesce(nullif(p_categoria, ''), 'otro'), prio, p_canal, now() + private.sla_de(prio))
  returning id into v_id;
  insert into public.ticket_mensajes (ticket_id, autor, autor_nombre, de_equipo, cuerpo) values (v_id, titular, left(nombre, 120), false, btrim(p_mensaje));
  perform private.auditar(s.user_id, s.nombre, 'creo_ticket', 'ticket', v_id::text, btrim(p_asunto),
                          jsonb_build_object('canal', p_canal, 'cuenta', titular is not null));
  return v_id;
end $$;

-- Mediana de la primera respuesta (30 días) y si el ticket cumplió su plazo.
create function public.consola_soporte_tiempos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('tickets');
  return (select jsonb_build_object(
            'mediana_min', round(extract(epoch from percentile_cont(0.5) within group (order by primera_respuesta - created_at)) / 60),
            'a_tiempo_pct', case when count(*) = 0 then null else round(100.0 * count(*) filter (where primera_respuesta <= sla_vence) / count(*)) end,
            'respondidos', count(*))
            from public.tickets where primera_respuesta is not null and created_at > now() - interval '30 days');
end $$;

-- ───────────────────────────── Analítica ─────────────────────────────

-- Segundos que tomó registrar un movimiento en Registrar (del primer toque a guardar; lo mide el navegador).
alter table public.transactions add column registro_ms int check (registro_ms between 0 and 600000);

create table public.inversion_canal (
  mes        date not null check (extract(day from mes) = 1),
  canal      text not null check (canal ~ '^[a-z0-9_-]{1,40}$'),
  monto      bigint not null check (monto >= 0),
  updated_at timestamptz not null default now(),
  primary key (mes, canal)
);
alter table public.inversion_canal enable row level security;
revoke all on public.inversion_canal from anon, authenticated;

create function public.consola_guardar_inversion(p_mes text, p_canal text, p_monto bigint) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('cobros');
  c text := lower(btrim(coalesce(p_canal, '')));
begin
  if p_mes !~ '^\d{4}-\d{2}$' or c !~ '^[a-z0-9_-]{1,40}$' or coalesce(p_monto, -1) < 0 then
    raise exception 'Escribe el mes, el canal (como llega en utm_source) y el monto.';
  end if;
  if p_monto = 0 then
    delete from public.inversion_canal where mes = (p_mes || '-01')::date and canal = c;
  else
    insert into public.inversion_canal (mes, canal, monto) values ((p_mes || '-01')::date, c, p_monto)
    on conflict (mes, canal) do update set monto = excluded.monto, updated_at = now();
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_inversion_canal', 'canal', c, c, jsonb_build_object('mes', p_mes, 'monto', p_monto));
end $$;

-- Lo que depende del periodo (7, 30 o 365 días) y el CAC de los últimos 90 días por canal
-- (inversión del canal ÷ hogares del canal que empezaron a pagar en esos 90 días).
create function public.consola_analitica_periodo(p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d int := case when p_dias in (7, 30, 365) then p_dias else 30 end;
  desde timestamptz := now() - make_interval(days => d);
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'dias', d,
    'registro_ms_mediana', (select round(percentile_cont(0.5) within group (order by registro_ms)) from public.transactions
                              where registro_ms is not null and created_at > desde),
    'registros_medidos', (select count(*) from public.transactions where registro_ms is not null and created_at > desde),
    'origenes', (select coalesce(jsonb_object_agg(origen, n), '{}'::jsonb) from (
                   select t.origen::text as origen, count(*) as n from public.transactions t
                    where t.created_at > desde and private.mov_activo(t.origen) group by 1) x),
    'activos', (select count(distinct household_id) from public.transactions t where t.created_at > desde and private.mov_activo(t.origen)),
    'inversion', (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(i.mes, 'YYYY-MM'), 'canal', i.canal, 'monto', i.monto) order by i.mes desc, i.canal), '[]'::jsonb)
                    from public.inversion_canal i where i.mes >= date_trunc('month', now()) - interval '11 months'),
    'cac', (select coalesce(jsonb_object_agg(x.canal, case when x.nuevos_pagan = 0 then null else round(x.inv / x.nuevos_pagan) end), '{}'::jsonb)
              from (select i.canal, sum(i.monto) as inv,
                           (select count(distinct c.household_id) from public.cobros c join public.households h on h.id = c.household_id
                             where c.estado = 'pagado' and c.motivo = 'alta' and c.pagado_en > now() - interval '90 days'
                               and coalesce(nullif(btrim(h.canal), ''), 'directo') = i.canal) as nuevos_pagan
                      from public.inversion_canal i where i.mes >= date_trunc('month', now() - interval '90 days')
                     group by i.canal) x));
end $$;

-- ───────────────────────────── Catálogos ─────────────────────────────

alter table public.import_batches
  add column banco text check (char_length(banco) <= 60),
  add column filas_invalidas int not null default 0 check (filas_invalidas >= 0);

-- Normaliza como normalizarDescripcion (sin tildes, minúsculas, solo letras y números separados por un espacio).
create function private.normalizar(t text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', ' ', 'g'))
$$;

create function public.consola_catalogos_uso(p_pais text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    -- Hogares que tienen (y no archivaron) una categoría raíz con ese nombre.
    'categorias', (select coalesce(jsonb_object_agg(b.nombre, (select count(distinct c.household_id) from public.categories c
                     where c.padre_id is null and not c.archivada and lower(c.nombre) = lower(b.nombre))), '{}'::jsonb)
                     from public.categorias_base b where b.pais = upper(p_pais) and b.padre_id is null),
    -- Movimientos de 30 días cuyo comercio contiene el patrón, y cuántos quedaron en la categoría de la regla.
    'reglas', (select coalesce(jsonb_object_agg(r.patron, jsonb_build_object('coincidencias', x.n, 'precision',
                 case when x.n = 0 then null else round(100.0 * x.ok / x.n, 1) end)), '{}'::jsonb)
                 from public.reglas_comercio_globales r
                 cross join lateral (
                   select count(*) as n, count(*) filter (where lower(c.nombre) = lower(r.categoria)) as ok
                     from public.transactions t left join public.categories c on c.id = t.category_id
                    where t.created_at > now() - interval '30 days' and t.comercio is not null
                      and (' ' || private.normalizar(t.comercio) || ' ') like ('% ' || r.patron || ' %')) x
                where r.pais = upper(p_pais)),
    -- Importaciones de 30 días reconocidas con cada formato y filas que no se pudieron leer.
    'formatos', (select coalesce(jsonb_object_agg(f.banco, jsonb_build_object('importaciones', y.n, 'errores_pct',
                   case when y.filas = 0 then null else round(100.0 * y.malas / y.filas, 1) end)), '{}'::jsonb)
                   from (select distinct banco from public.formatos_extracto where pais = upper(p_pais)) f
                   cross join lateral (select count(*) as n, coalesce(sum(filas_total + filas_invalidas), 0) as filas, coalesce(sum(filas_invalidas), 0) as malas
                                         from public.import_batches b where b.banco = f.banco and b.created_at > now() - interval '30 days') y));
end $$;

-- ───────────────────────────── Privacidad ─────────────────────────────

create function public.consola_privacidad_kpis() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('auditoria');
  return jsonb_build_object(
    'abiertas', (select count(*) from public.solicitudes_privacidad where estado in ('recibida', 'en_tramite')),
    'proxima_vence', (select min(vence) from public.solicitudes_privacidad where estado in ('recibida', 'en_tramite')),
    'atendidas_90d', (select count(*) from public.solicitudes_privacidad where resuelta_en > now() - interval '90 days'),
    'a_tiempo_90d', (select count(*) from public.solicitudes_privacidad where resuelta_en > now() - interval '90 days'
                       and (resuelta_en at time zone 'America/Bogota')::date <= vence),
    'supresiones_anio', (select count(*) from public.solicitudes_privacidad where suprimida_en >= date_trunc('year', now())),
    'accesos_30d', (select count(*) from public.accesos_soporte where estado in ('aprobado', 'revocado') and respondido_en > now() - interval '30 days'));
end $$;

-- ───────────────────────────── Parámetros DIAN ─────────────────────────────

alter table public.tax_tags
  add column grupo text check (grupo in ('ingreso', 'deduccion', 'retencion', 'exenta', 'patrimonio', 'otro')),
  add column limite text check (char_length(limite) <= 80);

create function public.consola_etiqueta_detalle(p_pais text, p_codigo text, p_grupo text, p_limite text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
begin
  update public.tax_tags set grupo = nullif(p_grupo, ''), limite = nullif(left(btrim(coalesce(p_limite, '')), 80), '')
   where pais = upper(p_pais) and codigo = p_codigo;
  if not found then
    raise exception 'Esa etiqueta no existe.';
  end if;
  perform private.auditar(s.user_id, s.nombre, 'guardo_etiqueta_dian', 'etiqueta', upper(p_pais) || ':' || p_codigo, p_codigo,
                          jsonb_build_object('grupo', p_grupo, 'limite', p_limite));
end $$;

create function public.consola_etiquetas_uso(p_pais text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'uso', (select coalesce(jsonb_object_agg(g.codigo, jsonb_build_object('grupo', g.grupo, 'limite', g.limite, 'uso',
              (select count(*) from public.transactions t where t.tax_tag_id = g.id and t.created_at > now() - interval '30 days'))), '{}'::jsonb)
              from public.tax_tags g where g.pais = upper(p_pais)),
    'revision', (select valor -> upper(p_pais) from public.plataforma_config where clave = 'revision_tributaria'));
end $$;

insert into public.plataforma_config (clave, valor) values ('revision_tributaria', '{}') on conflict (clave) do nothing;

-- «Última revisión contable»: el contador del equipo revisó UVT, topes y etiquetas del país.
create function public.consola_marcar_revision_tributaria(p_pais text, p_quien text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('parametros');
begin
  update public.plataforma_config
     set valor = valor || jsonb_build_object(upper(p_pais), jsonb_build_object('fecha', private.hoy(), 'quien', left(btrim(coalesce(nullif(p_quien, ''), s.nombre)), 80))),
         updated_at = now()
   where clave = 'revision_tributaria';
  perform private.auditar(s.user_id, s.nombre, 'revision_tributaria', 'pais', upper(p_pais), upper(p_pais), jsonb_build_object('quien', p_quien));
end $$;

-- ───────────────────────────── permisos y revisión de seguridad ─────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array['consola_usuarios_estado(uuid[])', 'consola_desbloquear(uuid)', 'solicitar_verificacion_contador(uuid, text, text, int, text)',
    'consola_solicitudes_contador()', 'consola_responder_solicitud_contador(uuid, text, text)', 'consola_pagar_comisiones(text)',
    'consola_contadores_conversion()', 'consola_crear_ticket(text, text, text, text, text, text, text)', 'consola_soporte_tiempos()',
    'consola_guardar_inversion(text, text, bigint)', 'consola_analitica_periodo(int)', 'consola_catalogos_uso(text)', 'consola_privacidad_kpis()',
    'consola_etiqueta_detalle(text, text, text, text)', 'consola_etiquetas_uso(text)', 'consola_marcar_revision_tributaria(text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

create or replace function public.revision_seguridad() returns table (tipo text, objeto text)
language sql stable security definer set search_path = '' as $$
  select 'tabla_sin_rls', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select 'vista_sin_security_invoker', c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any (c.reloptions) or 'security_invoker=on' = any (c.reloptions), false)
  union all
  select 'funcion_publica_para_anon', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('ver_invitacion', 'consola_ver_invitacion', 'revision_legal_ver', 'revision_legal_responder')
  union all
  select 'definer_sin_search_path', n.nspname || '.' || p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)
  union all
  select 'funcion_de_servidor_expuesta', p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname in ('registrar_pago_wompi', 'procesar_vencimientos', 'integracion_leer', 'integracion_evento',
                       'correos_de_usuarios', 'revision_seguridad', 'custom_access_token_hook', 'campana_hogares',
                       'campana_reclamar', 'campana_avance', 'purgar_retencion', 'guardar_metodo_pago',
                       'cobro_transaccion', 'cobros_para_debitar', 'correos_del_equipo', 'tickets_sin_respuesta',
                       'ingreso_bloqueado', 'registrar_ingreso', 'legal_avisos_pendientes', 'correos_titulares',
                       'plantilla_estado_meta', 'salud_registrar',
                       'telefonos_whatsapp', 'telefonos_del_equipo', 'mensaje_whatsapp_estado')
  union all
  select 'tabla_sensible_accesible', t || ' (' || r || ')'
    from unnest(array['auditoria', 'integraciones', 'staff_invitaciones', 'eventos_pasarela', 'cupones', 'cupones_usos',
                      'hogar_notas', 'avisos_enviados', 'eventos', 'correos_enviados', 'campanas', 'hogar_activo',
                      'registro_tecnico', 'respuestas_guardadas', 'categorias_base', 'documento_revisiones',
                      'intentos_ingreso', 'avisos_equipo_enviados', 'ofertas', 'ofertas_cerradas', 'enlaces_clics', 'aliados',
                      'plantillas_whatsapp', 'academia_vistas', 'academia_calificaciones', 'academia_recomendaciones',
                      'academia_talleres', 'academia_inscripciones', 'segmentos', 'salud_registros',
                      'roles_staff', 'mensajes_whatsapp', 'inversion_canal']) t
   cross join unnest(array['anon', 'authenticated']) r
   where has_table_privilege(r, 'public.' || t, 'select') or has_table_privilege(r, 'public.' || t, 'insert')
      or has_table_privilege(r, 'public.' || t, 'update') or has_table_privilege(r, 'public.' || t, 'delete')
  union all
  select 'bucket_publico', b.id from storage.buckets b where b.public
$$;
