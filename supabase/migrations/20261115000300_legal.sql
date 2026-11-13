-- Diseño «Admin SaaS» → Legal: documentos con versiones, revisión del abogado por enlace, publicación con fecha de
-- vigencia y aceptación de nuevo dentro de la app. El texto es Markdown sencillo (## títulos, - listas, **negrita**,
-- [enlace](url)) con variables {razon_social}, {nit}… que salen de Ajustes de la plataforma → Empresa.
-- La versión que guarda `consentimientos` sigue siendo una fecha: la de vigencia de la versión aceptada.

-- Permiso nuevo para el rol Contenido (el superadmin tiene todos).
create or replace function private.permisos_de_rol(r public.rol_staff) returns public.permiso_staff[]
language sql immutable set search_path = '' as $$
  select case r
    when 'superadmin' then enum_range(null::public.permiso_staff)
    when 'soporte'    then array['ver_hogares', 'ver_finanzas', 'usuarios', 'tickets']::public.permiso_staff[]
    when 'finanzas'   then array['ver_hogares', 'cobros', 'planes', 'exportar']::public.permiso_staff[]
    when 'contenido'  then array['ver_hogares', 'tickets', 'parametros', 'campanas', 'contenido_app']::public.permiso_staff[]
  end
$$;

create table public.documentos_legales (
  clave          text primary key check (clave ~ '^[a-z][a-z0-9_]{2,40}$'),
  nombre         text not null check (char_length(btrim(nombre)) between 3 and 80),
  consentimiento text unique check (consentimiento in ('politica_datos', 'terminos', 'comunicaciones')),
  obligatorio    boolean not null default false,   -- se exige para usar la app
  orden          int not null default 100,
  created_at     timestamptz not null default now()
);

create table public.documento_versiones (
  id               uuid primary key default gen_random_uuid(),
  documento        text not null references public.documentos_legales on delete cascade,
  version          text not null check (version ~ '^\d{1,3}\.\d{1,3}$'),
  contenido        text not null default '' check (char_length(contenido) <= 100000),
  resumen          text not null default '' check (char_length(resumen) <= 600),
  estado           text not null default 'borrador' check (estado in ('borrador', 'en_revision', 'aprobada', 'publicada')),
  vigente_desde    date,
  pedir_aceptacion boolean not null default true,
  avisar_correo    boolean not null default true,
  aviso_enviado_en timestamptz,
  revision_nota    text check (char_length(revision_nota) <= 2000),
  revisado_por     text,
  revisado_en      timestamptz,
  editado_nombre   text,
  updated_at       timestamptz not null default now(),
  publicada_en     timestamptz,
  publicada_por    text,
  unique (documento, version),
  check (estado <> 'publicada' or vigente_desde is not null)
);
-- Enlace del abogado: sha256 del token (como las invitaciones del equipo). Sin políticas: solo las funciones.
create table public.documento_revisiones (
  version_id uuid primary key references public.documento_versiones on delete cascade,
  correo     text not null,
  token_hash text not null unique,
  vence      timestamptz not null,
  enviado_en timestamptz not null default now()
);
alter table public.documento_revisiones enable row level security;
revoke all on public.documento_revisiones from anon, authenticated;

create index documento_versiones_doc_idx on public.documento_versiones (documento, estado, vigente_desde desc);

alter table public.documentos_legales enable row level security;
alter table public.documento_versiones enable row level security;
-- El texto publicado es público (páginas legales sin sesión); los borradores solo los ve la consola por sus funciones.
create policy documentos_lectura on public.documentos_legales for select to anon, authenticated using (true);
create policy versiones_publicadas on public.documento_versiones for select to anon, authenticated using (estado = 'publicada');
revoke insert, update, delete, truncate on public.documentos_legales, public.documento_versiones from anon, authenticated;

insert into public.documentos_legales (clave, nombre, consentimiento, obligatorio, orden) values
  ('politica_datos', 'Política de tratamiento de datos', 'politica_datos', true, 1),
  ('terminos', 'Términos y condiciones', 'terminos', true, 2),
  ('comunicaciones', 'Comunicaciones comerciales', 'comunicaciones', false, 3);

insert into public.documento_versiones (documento, version, contenido, resumen, estado, vigente_desde, revisado_por, revisado_en, publicada_en, publicada_por, editado_nombre) values
  ('politica_datos', '1.0', $md$Esta política explica cómo My House recoge, usa, guarda y protege tus datos personales, conforme a la Ley 1581 de 2012, el Decreto 1074 de 2015 (capítulo 25) y las demás normas colombianas de protección de datos.

## 1. Responsable del tratamiento

- **{razon_social}**, identificado con {identificacion}.
- Domicilio: {direccion}.
- Teléfono: {telefono}.
- Correo para consultas y reclamos sobre tus datos: [{correo_datos}](mailto:{correo_datos}).
- Sitio web: {sitio}.

## 2. Qué datos tratamos

- **De tu cuenta:** nombre, correo, contraseña (guardada cifrada; nadie puede leerla), y si la activas, la configuración de verificación en dos pasos.
- **De tu hogar:** nombre del hogar, ciudad, personas que lo integran, cuentas, ingresos, gastos, pagos fijos, deudas, metas, presupuestos y los soportes que subes (fotos, PDF y extractos).
- **De las personas a cargo** que registras (por ejemplo, hijos o padres): nombre, parentesco, fecha de nacimiento y notas que tú escribas.
- **Tributarios:** los dos últimos dígitos de la cédula (para el calendario de la DIAN), si los escribes.
- **De pago:** plan, fechas y estado de los cobros. Los datos de tu tarjeta o cuenta bancaria los recibe directamente Wompi; My House no los ve ni los guarda.
- **Técnicos:** dirección IP, navegador, fecha de ingreso y registros de errores (sin montos), para seguridad, prevención de fraude y soporte.

No pedimos datos sensibles (salud, origen étnico, orientación política o religiosa, datos biométricos). Te pedimos no escribirlos en las notas ni en las descripciones de los movimientos.

## 3. Para qué los usamos (finalidades)

- Crear y administrar tu cuenta y tu hogar, y permitir que las personas que invitas vean la misma información.
- Calcular el costo de vida, el número mínimo, los presupuestos, los pagos pendientes y el semáforo de renta.
- Leer comprobantes y extractos con inteligencia artificial, solo cuando tú los subes, para proponerte el movimiento y su categoría.
- Enviarte correos del servicio: códigos de acceso, avisos de seguridad, recordatorios de pago, resúmenes y avisos de la DIAN que actives.
- Cobrar el plan que elijas, emitir la factura y gestionar renovaciones, reembolsos y pagos fallidos.
- Atender tus solicitudes de soporte y las consultas o reclamos sobre tus datos.
- Proteger el servicio: detectar accesos sospechosos, abuso y fraude.
- Medir el uso del servicio de forma agregada para mejorarlo (sin vender ni ceder tus datos).
- Solo si lo autorizas aparte: enviarte novedades y promociones de My House. Puedes retirar esta autorización cuando quieras desde Recordatorios o con el enlace de cada correo.

My House **no vende** tus datos ni los usa para publicidad de terceros. Los proveedores de inteligencia artificial que usamos no entrenan sus modelos con lo que les enviamos.

## 4. Quién más trata tus datos (encargados) y transmisión internacional

Para prestar el servicio, estos proveedores tratan datos por cuenta nuestra y bajo nuestras instrucciones:

- Supabase Inc. (Estados Unidos): base de datos, archivos y acceso a la cuenta.
- Vercel Inc. (Estados Unidos): servidores donde funciona la aplicación.
- Resend (Estados Unidos): envío de correos.
- OpenAI y Anthropic (Estados Unidos): lectura de comprobantes y extractos que subes.
- Wompi, de Bancolombia S.A. (Colombia): procesamiento de pagos.
- Cloudflare (Estados Unidos) y Google (Estados Unidos), si usas el captcha o el ingreso con Google.

Varios de ellos guardan la información fuera de Colombia, principalmente en Estados Unidos. Al aceptar esta política autorizas esa **transmisión internacional**, que se hace con proveedores que ofrecen niveles adecuados de seguridad y que solo pueden usar los datos para prestarnos el servicio.

Dentro de tu hogar, la información la ven las personas que el administrador invita, según su rol. Un contador invitado solo puede leer. El equipo de My House no ve tus movimientos ni tus saldos: si necesitas ayuda con ellos, te pediremos acceso y tú decides si lo apruebas, por cuánto tiempo, y puedes revocarlo.

Solo entregaremos datos a una autoridad cuando una norma o una orden judicial o administrativa lo exija.

## 5. Datos de niños, niñas y adolescentes

My House es para personas mayores de edad. Los datos de menores que registres como personas a cargo los tratamos solo para las finalidades de tu hogar (por ejemplo, la orientación sobre dependientes en la declaración de renta), respetando su interés superior y sus derechos fundamentales. Al registrarlos declaras que eres su representante legal o que cuentas con su autorización.

## 6. Tus derechos

Como titular de los datos tienes derecho a:

- Conocer, actualizar y rectificar tus datos.
- Pedir prueba de la autorización que nos diste.
- Saber qué uso le hemos dado a tus datos.
- Revocar la autorización y pedir que borremos tus datos, cuando no haya un deber legal de conservarlos.
- Acceder gratis a tus datos.
- Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber hecho la consulta o el reclamo ante nosotros.

Muchos de estos derechos los ejerces directamente en la app: editar tu perfil y tu hogar, borrar movimientos o soportes, y apagar los correos de novedades.

## 7. Cómo hacer una consulta o un reclamo

Escríbenos a [{correo_datos}](mailto:{correo_datos}) desde el correo de tu cuenta, o desde [Ayuda](/ayuda) en la app. Indica tu nombre, tu identificación, qué pides y, si es un reclamo, los hechos y los documentos que quieras aportar. Si actúas en nombre de otra persona, adjunta el documento que te autoriza.

- **Consultas** (qué datos tenemos, cómo los usamos): respondemos en máximo 10 días hábiles, prorrogables una vez por 5 días hábiles más, avisándote el motivo.
- **Reclamos** (corregir, actualizar, borrar, revocar la autorización o reportar un incumplimiento): respondemos en máximo 15 días hábiles, prorrogables una vez por 8 días hábiles más. Si el reclamo está incompleto te pediremos lo que falta dentro de los 5 días siguientes; si no lo envías en 2 meses, entenderemos que desististe.

## 8. Cuánto tiempo guardamos tus datos

- Los datos de tu cuenta y tu hogar, mientras tengas la cuenta.
- Si pides borrarlos, eliminamos la cuenta, los soportes y los hogares en los que eres la única persona con cuenta. En un hogar compartido, se borra tu acceso y la información del hogar sigue disponible para las demás personas.
- Los datos de cobros y facturación los conservamos por el tiempo que exigen las normas contables y tributarias.
- Los registros técnicos y de correos enviados, 90 días.
- La prueba de tu autorización, mientras exista la cuenta y el tiempo necesario para atender reclamos.

## 9. Seguridad

Ciframos la información en tránsito y en reposo, aislamos los datos de cada hogar en la base de datos, ofrecemos verificación en dos pasos y exigimos verificación en dos pasos a todo el equipo de My House. Cada acción del equipo queda registrada en un historial que no se puede modificar. Ningún sistema es infalible: si ocurre un incidente que afecte tus datos, te avisaremos y lo reportaremos a la SIC como lo exige la ley.

## 10. Cookies

Usamos solo cookies necesarias: mantener tu sesión, recordar este navegador para avisarte de ingresos desde dispositivos nuevos y saber de qué campaña o contador llegaste. No usamos cookies de publicidad.

## 11. Cambios y vigencia

Esta política rige desde la fecha de la versión indicada arriba. Si la cambiamos de forma sustancial te avisaremos por correo o en la app y, cuando la ley lo exija, te pediremos aceptarla de nuevo.$md$, 'Primera versión.', 'publicada', '2026-11-11', 'Texto inicial', now(), now(), 'Sistema', 'Sistema'),
  ('terminos', '1.0', $md$Estos términos regulan el uso de My House, el servicio en línea para registrar las finanzas de tu hogar que ofrece **{razon_social}** ({identificacion}), con domicilio en {direccion} («My House», «nosotros»). Al crear una cuenta los aceptas.

## 1. El servicio

My House te permite registrar ingresos, gastos, pagos fijos, deudas y metas; calcular el costo de vida de tu hogar; compartirlo con las personas que invites; leer comprobantes con inteligencia artificial y ver una orientación sobre la declaración de renta.

**My House no es asesoría contable, tributaria, financiera ni legal.** El semáforo de renta, los topes de la DIAN, la orientación sobre dependientes y los cálculos son orientativos y dependen de lo que registras. Antes de declarar o tomar decisiones importantes, consulta a un contador. Las lecturas de la inteligencia artificial pueden tener errores: revísalas.

## 2. Tu cuenta

- Debes ser mayor de edad y dar información verdadera.
- Eres responsable de cuidar tu contraseña y lo que se haga con tu cuenta. Te recomendamos activar la verificación en dos pasos.
- El administrador de un hogar decide a quién invita y con qué rol; las personas invitadas ven la información del hogar según ese rol.
- Avísanos de inmediato a {correo_soporte} si crees que alguien entró a tu cuenta.

## 3. Uso permitido

No puedes usar My House para:

- Actividades ilegales, lavado de activos o para ocultar información a las autoridades.
- Registrar datos de otras personas sin estar autorizado.
- Intentar acceder a información de otros hogares, vulnerar la seguridad o sobrecargar el servicio.
- Copiar, revender o usar el servicio de forma automatizada sin nuestra autorización.

Si incumples estas reglas podemos suspender o cerrar la cuenta, avisándote cuando sea posible.

## 4. Tus datos

La información que registras es tuya. Nos das permiso para guardarla y procesarla solo para prestarte el servicio, como explica la [política de tratamiento de datos](/privacidad) . Puedes pedir una copia o que la borremos.

## 5. Planes, pagos y cancelación

- Hay un plan gratuito y planes pagos. Los precios publicados incluyen IVA. Los límites de cada plan se muestran en Configuración → Plan.
- Los pagos se hacen a través de Wompi por el periodo que elijas (mensual o anual). Antes de que termine el periodo te enviamos un cobro para renovarlo; si no se paga, después de un periodo de gracia el hogar pasa al plan gratuito sin perder la información.
- Puedes pedir que no se renueve en cualquier momento; conservas el plan hasta el fin del periodo pagado.
- **Derecho de retracto:** puedes retractarte de la compra dentro de los 5 días hábiles siguientes al pago (artículo 47 de la Ley 1480 de 2011) escribiendo a {correo_soporte}. Devolvemos el dinero en un plazo máximo de 30 días calendario.
- Si cambian los precios, te avisaremos con al menos 30 días de anticipación; el cambio aplica desde la siguiente renovación.
- La prueba gratuita de un plan pago se ofrece una sola vez por hogar.

## 6. Disponibilidad

Trabajamos para que My House esté disponible siempre, pero puede haber interrupciones por mantenimiento o fallas de proveedores. Podemos cambiar o retirar funciones; si retiramos una función pagada de forma sustancial, te avisaremos con anticipación.

## 7. Responsabilidad

My House se ofrece para ayudarte a organizar tus finanzas. En la medida en que lo permite la ley, no respondemos por decisiones financieras o tributarias tomadas con base en los cálculos de la app, ni por sanciones derivadas de declaraciones presentadas con información incompleta o errada. Nada de esto limita los derechos que te da el Estatuto del Consumidor (Ley 1480 de 2011).

## 8. Propiedad intelectual

La marca My House, el diseño y el software son de {razon_social}. Te damos una licencia personal, no exclusiva e intransferible para usar la app mientras tengas cuenta.

## 9. Cierre de la cuenta

Puedes dejar de usar My House cuando quieras y pedir que borremos tu cuenta escribiendo a {correo_datos}. El borrado sigue lo descrito en la política de tratamiento de datos.

## 10. Cambios a estos términos

Si cambiamos estos términos de forma sustancial te avisaremos por correo o en la app antes de que apliquen y te pediremos aceptarlos de nuevo para seguir usando el servicio.

## 11. Ley aplicable y contacto

Estos términos se rigen por las leyes de la República de Colombia. Si tienes un problema, escríbenos primero a {correo_soporte}; también puedes acudir a la Superintendencia de Industria y Comercio. Teléfono: {telefono}.$md$, 'Primera versión.', 'publicada', '2026-11-11', 'Texto inicial', now(), now(), 'Sistema', 'Sistema'),
  ('comunicaciones', '1.0', $md$Al marcar esta casilla aceptas que My House te envíe por correo novedades del producto, consejos de finanzas del hogar y ofertas de sus planes y aliados.

- Es opcional: no aceptarla no cambia nada en el servicio.
- Puedes retirarla cuando quieras en Configuración → Privacidad y datos, o con el enlace «Dejar de recibirlos» de cada correo.$md$, 'Primera versión.', 'publicada', '2026-11-11', 'Texto inicial', now(), now(), 'Sistema', 'Sistema');

-- Versión vigente (la publicada más reciente que ya entró en vigencia) y la que se exige aceptar
-- (la vigente más reciente que pidió aceptación).
create function private.version_vigente(p_doc text) returns date
language sql stable set search_path = '' as $$
  select max(vigente_desde) from public.documento_versiones
   where documento = p_doc and estado = 'publicada' and vigente_desde <= (now() at time zone 'America/Bogota')::date
$$;
create function private.version_exigida(p_doc text) returns date
language sql stable set search_path = '' as $$
  select max(vigente_desde) from public.documento_versiones
   where documento = p_doc and estado = 'publicada' and pedir_aceptacion and vigente_desde <= (now() at time zone 'America/Bogota')::date
$$;

-- Documentos obligatorios que la persona aún no acepta en la versión exigida (con el resumen de cambios).
create function public.mis_pendientes_legales() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('clave', d.clave, 'nombre', d.nombre, 'version', v.version, 'vigente_desde', v.vigente_desde,
                   'resumen', v.resumen) order by d.orden), '[]'::jsonb)
    from public.documentos_legales d
    join lateral (select * from public.documento_versiones x where x.documento = d.clave and x.estado = 'publicada'
                   and x.vigente_desde = private.version_vigente(d.clave) limit 1) v on true
   where auth.uid() is not null and d.obligatorio
     and private.version_exigida(d.clave) is not null
     and not exists (select 1 from public.consentimientos c where c.user_id = auth.uid() and c.tipo = d.consentimiento and c.aceptado
                       and c.version >= to_char(private.version_exigida(d.clave), 'YYYY-MM-DD'))
$$;

-- Acepta las versiones vigentes de los obligatorios (y responde comunicaciones si se envía).
create function public.aceptar_vigentes(p_comunicaciones boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
  ip text := left(coalesce(private.cabecera('x-mh-ip'), btrim(split_part(private.cabecera('x-forwarded-for'), ',', 1))), 64);
  agente text := left(private.cabecera('x-mh-agente'), 300);
begin
  if yo is null then
    raise exception 'Necesitas una sesión.';
  end if;
  insert into public.consentimientos (user_id, tipo, version, aceptado, origen, ip, agente)
  select yo, d.consentimiento, to_char(coalesce(private.version_vigente(d.clave), current_date), 'YYYY-MM-DD'), true, 'app', ip, agente
    from public.documentos_legales d where d.obligatorio and d.consentimiento is not null;
  if p_comunicaciones is not null then
    insert into public.consentimientos (user_id, tipo, version, aceptado, origen, ip, agente)
    values (yo, 'comunicaciones', to_char(coalesce(private.version_vigente('comunicaciones'), current_date), 'YYYY-MM-DD'), p_comunicaciones, 'app', ip, agente);
  end if;
end $$;

-- El registro guarda la versión vigente de cada documento (no una fecha fija del código).
create or replace function private.consentimiento_al_registrarse() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb := new.raw_user_meta_data -> 'consentimiento';
  v text := c ->> 'version';
begin
  if c is null or v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then
    return new;
  end if;
  insert into public.consentimientos (user_id, tipo, version, aceptado, origen, ip, agente)
  select new.id, t.tipo, coalesce(to_char(private.version_vigente(t.tipo), 'YYYY-MM-DD'), v), t.aceptado, 'registro', left(c ->> 'ip', 64), left(c ->> 'agente', 300)
    from (values ('politica_datos', true), ('terminos', true),
                 ('comunicaciones', coalesce((c ->> 'comunicaciones')::boolean, false))) as t (tipo, aceptado);
  return new;
end $$;

-- ───────────────────────── consola ─────────────────────────

create function public.consola_legal() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  usuarios bigint;
begin
  perform private.exigir_staff('ver_hogares');
  select count(*) into usuarios from auth.users where deleted_at is null;
  return jsonb_build_object(
    'usuarios', usuarios,
    'documentos', (select coalesce(jsonb_agg(jsonb_build_object(
        'clave', d.clave, 'nombre', d.nombre, 'consentimiento', d.consentimiento, 'obligatorio', d.obligatorio,
        'vigente', private.version_vigente(d.clave), 'exigida', private.version_exigida(d.clave),
        'versiones', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', v.id, 'version', v.version, 'contenido', v.contenido, 'resumen', v.resumen, 'estado', v.estado,
            'vigente_desde', v.vigente_desde, 'pedir_aceptacion', v.pedir_aceptacion, 'avisar_correo', v.avisar_correo,
            'aviso_enviado_en', v.aviso_enviado_en, 'revision_correo', r.correo, 'revision_vence', r.vence,
            'revision_nota', v.revision_nota, 'revisado_por', v.revisado_por, 'revisado_en', v.revisado_en,
            'editado_nombre', v.editado_nombre, 'updated_at', v.updated_at, 'publicada_en', v.publicada_en)
            order by string_to_array(v.version, '.')::int[] desc), '[]'::jsonb)
          from public.documento_versiones v left join public.documento_revisiones r on r.version_id = v.id where v.documento = d.clave),
        'aceptaron', case when d.consentimiento is null then null else
          (select count(distinct c.user_id) from public.consentimientos c where c.tipo = d.consentimiento and c.aceptado
              and c.version >= coalesce(to_char(private.version_exigida(d.clave), 'YYYY-MM-DD'), '0000')
              and not exists (select 1 from public.consentimientos n where n.user_id = c.user_id and n.tipo = c.tipo and n.created_at > c.created_at and not n.aceptado)) end)
        order by d.orden, d.nombre), '[]'::jsonb)
      from public.documentos_legales d));
end $$;

create function public.consola_nuevo_documento(p_clave text, p_nombre text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
begin
  if coalesce(p_clave, '') !~ '^[a-z][a-z0-9_]{2,40}$' then
    raise exception 'La clave va en minúsculas, sin espacios ni tildes (ej.: politica_cookies).';
  end if;
  if exists (select 1 from public.documentos_legales where clave = p_clave) then
    raise exception 'Ya hay un documento con esa clave.';
  end if;
  insert into public.documentos_legales (clave, nombre, orden) values (p_clave, btrim(p_nombre), 50);
  insert into public.documento_versiones (documento, version, editado_nombre) values (p_clave, '1.0', s.nombre);
  perform private.auditar(s.user_id, s.nombre, 'creo_documento_legal', 'legal', p_clave, btrim(p_nombre), '{}'::jsonb);
end $$;

-- Crea el borrador de la versión siguiente copiando la vigente (o devuelve el borrador que ya existe).
create function public.consola_nueva_version(p_doc text, p_mayor boolean) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  ultima public.documento_versiones;
  partes int[];
  nueva text;
  nid uuid;
begin
  select id into nid from public.documento_versiones where documento = p_doc and estado <> 'publicada' limit 1;
  if nid is not null then
    return nid;
  end if;
  select * into ultima from public.documento_versiones where documento = p_doc
   order by string_to_array(version, '.')::int[] desc limit 1;
  if ultima.id is null then
    raise exception 'Ese documento no existe.';
  end if;
  partes := string_to_array(ultima.version, '.')::int[];
  nueva := case when p_mayor then (partes[1] + 1) || '.0' else partes[1] || '.' || (partes[2] + 1) end;
  insert into public.documento_versiones (documento, version, contenido, editado_nombre, pedir_aceptacion)
  values (p_doc, nueva, ultima.contenido, s.nombre, p_mayor) returning id into nid;
  perform private.auditar(s.user_id, s.nombre, 'nueva_version_legal', 'legal', p_doc, p_doc || ' v' || nueva, '{}'::jsonb);
  return nid;
end $$;

-- Guardar el borrador. Cambiar el texto de una versión ya aprobada la devuelve a borrador (hay que revisarla otra vez).
create function public.consola_guardar_version(p_id uuid, p_contenido text, p_resumen text, p_vigente date, p_pedir boolean, p_avisar boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  v public.documento_versiones;
begin
  select * into v from public.documento_versiones where id = p_id for update;
  if v.id is null then
    raise exception 'Esa versión no existe.';
  end if;
  if v.estado = 'publicada' then
    raise exception 'Una versión publicada no se edita: crea una versión nueva.';
  end if;
  if p_vigente is not null and p_vigente < (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha de vigencia no puede ser pasada.';
  end if;
  update public.documento_versiones set
    contenido = coalesce(p_contenido, ''), resumen = btrim(coalesce(p_resumen, '')), vigente_desde = p_vigente,
    pedir_aceptacion = coalesce(p_pedir, true), avisar_correo = coalesce(p_avisar, true), editado_nombre = s.nombre, updated_at = now(),
    estado = case when v.contenido is distinct from coalesce(p_contenido, '') and v.estado in ('en_revision', 'aprobada') then 'borrador' else v.estado end,
    revisado_por = case when v.contenido is distinct from coalesce(p_contenido, '') then null else v.revisado_por end,
    revisado_en = case when v.contenido is distinct from coalesce(p_contenido, '') then null else v.revisado_en end
  where id = p_id;
  if v.contenido is distinct from coalesce(p_contenido, '') then
    delete from public.documento_revisiones where version_id = p_id;
  end if;
end $$;

-- «Enviar al abogado»: guarda el sha256 del token (el enlace lo arma el servidor y lo manda por correo).
create function public.consola_pedir_revision(p_id uuid, p_correo text, p_token text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  v public.documento_versiones;
begin
  select * into v from public.documento_versiones where id = p_id for update;
  if v.id is null or v.estado = 'publicada' then
    raise exception 'Esa versión no se puede enviar a revisión.';
  end if;
  if coalesce(p_correo, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Escribe el correo del abogado.';
  end if;
  if char_length(btrim(v.contenido)) < 20 then
    raise exception 'El documento está vacío.';
  end if;
  if char_length(coalesce(p_token, '')) < 32 then
    raise exception 'Token inválido.';
  end if;
  update public.documento_versiones set estado = 'en_revision', revision_nota = null, revisado_por = null, revisado_en = null, updated_at = now()
   where id = p_id;
  insert into public.documento_revisiones (version_id, correo, token_hash, vence)
  values (p_id, lower(btrim(p_correo)), private.huella_token(p_token), now() + interval '14 days')
  on conflict (version_id) do update set correo = excluded.correo, token_hash = excluded.token_hash, vence = excluded.vence, enviado_en = now();
  perform private.auditar(s.user_id, s.nombre, 'pidio_revision_legal', 'legal', v.documento, v.documento || ' v' || v.version, jsonb_build_object('abogado', lower(btrim(p_correo))));
end $$;

-- Página del abogado (sin cuenta, con el token del enlace): ver la versión y la anterior para comparar.
create function public.revision_legal_ver(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', v.id, 'documento', d.nombre, 'version', v.version, 'contenido', v.contenido, 'resumen', v.resumen,
           'estado', v.estado, 'vence', r.vence, 'nota', v.revision_nota, 'revisado_por', v.revisado_por,
           'anterior', (select a.contenido from public.documento_versiones a where a.documento = v.documento and a.estado = 'publicada'
                          order by a.vigente_desde desc limit 1),
           'version_anterior', (select a.version from public.documento_versiones a where a.documento = v.documento and a.estado = 'publicada'
                          order by a.vigente_desde desc limit 1))
    from public.documento_revisiones r
    join public.documento_versiones v on v.id = r.version_id
    join public.documentos_legales d on d.clave = v.documento
   where r.token_hash = private.huella_token(coalesce(p_token, '')) and r.vence > now()
$$;

create function public.revision_legal_responder(p_token text, p_aprobada boolean, p_nombre text, p_nota text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.documento_versiones;
  correo text;
begin
  select x.* into v from public.documento_revisiones r join public.documento_versiones x on x.id = r.version_id
   where r.token_hash = private.huella_token(coalesce(p_token, '')) and r.vence > now() for update of x;
  select r.correo into correo from public.documento_revisiones r where r.version_id = v.id;
  if v.id is null then
    raise exception 'El enlace venció o ya no es válido.';
  end if;
  if v.estado <> 'en_revision' then
    raise exception 'Esta versión ya fue revisada.';
  end if;
  if char_length(btrim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Escribe tu nombre.';
  end if;
  if not p_aprobada and char_length(btrim(coalesce(p_nota, ''))) < 5 then
    raise exception 'Cuéntanos qué hay que cambiar.';
  end if;
  update public.documento_versiones set estado = case when p_aprobada then 'aprobada' else 'borrador' end,
    revisado_por = left(btrim(p_nombre), 120), revisado_en = now(), revision_nota = nullif(left(btrim(coalesce(p_nota, '')), 2000), ''), updated_at = now()
   where id = v.id;
  perform private.auditar(null, left(btrim(p_nombre), 120), case when p_aprobada then 'abogado_aprobo' else 'abogado_pidio_cambios' end,
                          'legal', v.documento, v.documento || ' v' || v.version, jsonb_build_object('correo', correo));
end $$;

create function public.consola_publicar_version(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.platform_staff := private.exigir_staff('contenido_app');
  v public.documento_versiones;
begin
  select * into v from public.documento_versiones where id = p_id for update;
  if v.id is null or v.estado <> 'aprobada' then
    raise exception 'Se puede publicar cuando el abogado la apruebe.';
  end if;
  if v.vigente_desde is null then
    raise exception 'Elige la fecha en que entra en vigencia.';
  end if;
  if v.vigente_desde < (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha de vigencia ya pasó: elige hoy o una fecha futura.';
  end if;
  if exists (select 1 from public.documento_versiones o where o.documento = v.documento and o.estado = 'publicada' and o.vigente_desde >= v.vigente_desde) then
    raise exception 'Ya hay una versión publicada desde esa fecha o después.';
  end if;
  update public.documento_versiones set estado = 'publicada', publicada_en = now(), publicada_por = s.nombre, updated_at = now()
   where id = p_id;
  delete from public.documento_revisiones where version_id = p_id;
  perform private.auditar(s.user_id, s.nombre, 'publico_version_legal', 'legal', v.documento, v.documento || ' v' || v.version,
                          jsonb_build_object('vigente_desde', v.vigente_desde, 'pedir_aceptacion', v.pedir_aceptacion));
end $$;

-- Avisos por correo de versiones que entran en vigencia en ≤ 10 días (cron /api/avisos). Marca y devuelve.
create function public.legal_avisos_pendientes() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb;
begin
  with x as (
    update public.documento_versiones v set aviso_enviado_en = now()
     where v.estado = 'publicada' and v.avisar_correo and v.aviso_enviado_en is null
       and v.vigente_desde - (now() at time zone 'America/Bogota')::date between 0 and 10
    returning v.documento, v.version, v.vigente_desde, v.resumen)
  select coalesce(jsonb_agg(jsonb_build_object('documento', d.nombre, 'clave', d.clave, 'version', x.version, 'vigente_desde', x.vigente_desde, 'resumen', x.resumen)), '[]'::jsonb)
    into r from x join public.documentos_legales d on d.clave = x.documento;
  return r;
end $$;

-- Correos de todas las personas con cuenta (para el aviso legal; por páginas). Solo service_role.
create function public.correos_titulares(p_despues uuid, p_limite int) returns table (id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text from auth.users u
   where u.deleted_at is null and u.email is not null and (p_despues is null or u.id > p_despues)
     and not exists (select 1 from public.platform_staff s where s.user_id = u.id)
   order by u.id limit least(greatest(p_limite, 1), 500)
$$;

-- Insignias: ahora también las versiones legales que esperan algo del equipo.
create or replace function public.consola_insignias() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.exigir_staff('ver_hogares');
  return jsonb_build_object(
    'contadores', (select count(*) from public.households h where h.plan = 'contador' and not h.contador_verificado),
    'soporte', (select count(*) from public.tickets where estado = 'abierto' and primera_respuesta is null and prioridad in ('urgente', 'alta')),
    'cobros', (select count(*) from public.suscripciones where estado = 'vencida'),
    'legal', (select count(*) from public.documento_versiones where estado = 'aprobada'));
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['mis_pendientes_legales()', 'aceptar_vigentes(boolean)', 'consola_legal()', 'consola_nuevo_documento(text, text)',
                           'consola_nueva_version(text, boolean)', 'consola_guardar_version(uuid, text, text, date, boolean, boolean)',
                           'consola_pedir_revision(uuid, text, text)', 'consola_publicar_version(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- El abogado entra sin cuenta: solo con el token del enlace.
  foreach f in array array['revision_legal_ver(text)', 'revision_legal_responder(text, boolean, text, text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  foreach f in array array['legal_avisos_pendientes()', 'correos_titulares(uuid, int)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
revoke execute on function private.version_vigente(text), private.version_exigida(text) from public, anon, authenticated;
