# Roadmap SaaS: de la app de una familia a la plataforma

Guía de desarrollo de la Fase SaaS de My House. Parte de las 16 pantallas de la sección **Admin SaaS** del lienzo
«My House — Pantallas webapp» en claude.ai (`project/Admin*.dc.html`) y del borrador del proyecto (planes, canales y
métricas). Rama de trabajo: `feat/saas`.

## 1. Objetivo

My House responde tres preguntas de un hogar: **cuánto cuesta vivir cada mes, cuánto puede ahorrar y qué necesita
para declarar renta sin correr en agosto**. La Fase 1 (MVP para una familia) está terminada y verificada: registro
manual, CSV y con IA, costo de vida, presupuesto, pagos fijos, semáforo DIAN, correos y PWA, todo multi-tenant con RLS.

La Fase SaaS abre la app a muchas familias y la convierte en negocio:

| Meta | Indicador (del borrador) |
| --- | --- |
| Cualquier familia se registra, prueba y paga sola | Conversión gratis → pago ≥ 18 % |
| Los hogares siguen registrando | Retención a 3 meses ≥ 60 % · registro < 10 s |
| Los contadores traen y atienden hogares | Canal con mejor conversión y menor CAC |
| El equipo opera sin tocar la base a mano | Todo cambio de precio, UVT o catálogo desde la consola, con auditoría |
| Los datos financieros siguen siendo privados | Nadie del equipo ve las finanzas de un hogar sin permiso de su administrador |

Beta: 20–50 familias. Criterio de salida: retención mensual > 60 % y al menos 10 hogares pagando.

## 2. Qué muestran las pantallas

La consola es una app aparte para el **equipo de My House** (no para los hogares): barra lateral con 15 secciones,
franja superior «Consola de administración · Producción», búsqueda global (hogar, usuario, correo o factura) y el
rol de quien entra.

| # | Pantalla | Información | Funciones | Depende de |
| --- | --- | --- | --- | --- |
| 1 | **Ingreso a la consola** | Correo del equipo, código TOTP | Contraseña + 2FA obligatoria, «confiar en este equipo 12 h», llave de seguridad; cada ingreso queda con fecha, IP y dispositivo | Equipo, auditoría |
| 2 | **Panel general** | MRR, hogares activos 30 d, hogares pagando por plan, conversión, churn, ARPU; MRR 12 meses; embudo de activación; nuevos hogares por semana | Periodo 7 d / 30 d / 12 m, exportar, alertas («requiere atención»), actividad reciente de la plataforma | Cobros, eventos |
| 3 | **Analítica** | Retención a 3 meses, movimientos por hogar/semana, tiempo de registro, hogares con pareja activa; cohortes mensuales; adquisición por canal con conversión y CAC | Periodo | Eventos, canal de llegada, inversión por canal |
| 4 | **Hogares** | Lista: plan, miembros, movimientos 30 d, MRR, estado (activo, pago fallido, supresión pedida, inactivo, suspendido), último uso, alta | Buscar, filtrar por plan/estado, exportar CSV, crear hogar, selección múltiple | Planes |
| 5 | **Detalle de hogar** | Uso (movimientos, comprobantes, WhatsApp, almacenamiento vs. límite), miembros con rol y 2FA, facturas, suscripción, canal de llegada, historial | Cambiar plan, reembolsar, suspender, reenviar invitación, **pedir permiso** para ver datos financieros, notas internas | Cobros, acceso de soporte |
| 6 | **Usuarios** | Todas las cuentas: hogar, rol, 2FA, último ingreso, estado (bloqueado por intentos) | Buscar, filtrar, cerrar sesiones, restablecer 2FA; correos enmascarados (verlos completos se audita) | Auditoría |
| 7 | **Suscripciones y cobros** | Cobrado del mes, fallidos, recuperación por reintento, próximos 7 días; cobros con pasarela, método y factura DIAN; métodos de pago | Conciliar, exportar, secuencia de recuperación (día 0 correo, 3 WhatsApp, 7 reintento + banner, 14 pasa a Gratis) | Pasarela, factura electrónica |
| 8 | **Planes y cupones** | Gratis / Familia ($19.900 mes, $199.000 año) / Contador ($99.000, $990.000) con límites: hogares, personas, comprobantes IA, WhatsApp, pronóstico, renta, almacenamiento, comisión | Editar y «publicar cambios», historial; cupones (%, meses gratis, usos, vencimiento, programados); reglas: prueba 14 días sin tarjeta, descuento anual visible, IVA incluido, moneda | Cobros |
| 9 | **Contadores** | Activos, hogares referidos, conversión de sus hogares, comisiones del mes; aliados con hogares y verificación (tarjeta profesional) | Invitar, aprobar solicitudes, pedir datos, ver su panel, pagar comisiones (20 %) | Multi-hogar, referidos |
| 10 | **Soporte** | Tickets con prioridad y SLA, conversación, datos del hogar, registro técnico (errores de importación) | Filtrar, responder con respuestas guardadas, nota interna, escalar, resolver | Registro técnico |
| 11 | **Parámetros DIAN** | UVT por año con fuente y estado, topes en UVT y su valor en pesos, calendario de vencimientos, país (Colombia / IRS borrador) | Cargar UVT y calendario, ver cambios, publicar | `tax_params`, `tax_tags` |
| 12 | **Catálogos** | Categorías por defecto (tipo, subcategorías, etiqueta DIAN, uso); reglas globales de comercio con precisión y origen (manual / aprendida / ambigua); formatos de extracto por banco con tasa de error | Crear categoría, importar reglas, activar/desactivar regla | Importación, IA |
| 13 | **IA y automatizaciones** | Comprobantes leídos, precisión de categoría, costo del mes, tiempo de lectura; configuración; WhatsApp Business y plantillas; flujos n8n | Umbral de confianza, duplicados, NIT, tope de gasto mensual | Registro de uso y costo; WhatsApp (otra fase) |
| 14 | **Comunicaciones** | Correos automáticos con envíos, apertura y clic; campañas programadas y enviadas | Nueva campaña: segmento, canal (correo, WhatsApp, aviso en la app), fecha; enviar prueba; solo a quien aceptó comunicaciones | Registro de correos, consentimiento |
| 15 | **Equipo y permisos** | Personas, rol, tipo de 2FA, último ingreso; matriz de permisos por rol | Invitar, editar rol; políticas: 2FA obligatoria, cierre por inactividad (30 min), IP permitidas | — |
| 16 | **Privacidad y auditoría** | Solicitudes Ley 1581 (consulta 10 días hábiles, reclamo 15) con plazo; registro de auditoría inmutable; políticas (versión, retención 90 días, respaldos) | Atender, enviar exportación, ejecutar supresión, exportar auditoría | Auditoría |
| 17 | **Sistema** | Estado y disponibilidad por servicio, feature flags, versión, errores, colas, último respaldo | Encender funciones por plan / % / equipo, modo mantenimiento | — |

### Roles del equipo (matriz de la pantalla 15)

| Permiso | Superadmin | Soporte | Finanzas | Contenido |
| --- | :-: | :-: | :-: | :-: |
| Ver lista de hogares y métricas | ✓ | ✓ | ✓ | ✓ |
| Ver datos financieros de un hogar (con permiso) | ✓ | ✓ | | |
| Responder tickets | ✓ | ✓ | | ✓ |
| Reembolsos y cambios de plan | ✓ | | ✓ | |
| Editar planes, precios y cupones | ✓ | | ✓ | |
| Editar parámetros DIAN y catálogos | ✓ | | | ✓ |
| Enviar campañas | ✓ | | | ✓ |
| Gestionar equipo y roles | ✓ | | | |
| Exportar datos | ✓ | | ✓ | |
| Feature flags y mantenimiento | ✓ | | | |

## 3. Lo que ya existe y lo que falta

| Ya hay | Falta |
| --- | --- |
| `households.plan` (texto, `'gratis'`) | Tabla de planes con límites, suscripciones, cobros, cupones |
| RLS por hogar, roles admin/editor/contador | Personas del equipo (staff) fuera de los hogares, con sus roles y sin acceso a finanzas |
| `ia_usos` + `reservar_uso_ia` (30/h por persona, 150/día por hogar, fijos en SQL) | Topes que salgan del plan; costo por lectura; precisión |
| `tax_params`, `tax_tags` (se editan por migración) | Pantalla para editarlos; calendario de vencimientos por dígitos de cédula |
| `sembrar_categorias()` con la lista fija en SQL | Catálogo de categorías por defecto editable |
| `merchant_rules` por hogar | Reglas globales (todas las familias) |
| Correos con Resend y avisos programados | Registro de envíos, apertura/clic (webhooks), campañas, consentimiento comercial |
| Un usuario opera un hogar (decisión 14) | Selector de hogares: lo necesita el contador con 30 clientes |
| Captcha, 2FA, aviso de nuevo dispositivo | Auditoría de acciones del equipo, acceso de soporte con permiso, Ley 1581 |

## 4. Decisiones de arquitectura

1. **La consola vive en la misma app**, en `src/app/(consola)/consola/*` con su propio layout (barra lateral de 15
   secciones). Comparte diseño, Supabase y despliegue. Si después se quiere aislar, se sirve en `admin.<dominio>` con
   el proxy, sin mover código.
2. **El equipo es una tabla aparte**: `platform_staff (user_id, rol, activo)` con roles `superadmin`, `soporte`,
   `finanzas`, `contenido`. Un miembro del equipo no es miembro de ningún hogar por serlo; si usa la app como cliente,
   es otra fila en `members`.
3. **El JWT trae `staff_rol`** (se agrega a `custom_access_token_hook`). El proxy exige AAL2 en `/consola` siempre: 2FA
   obligatoria para el equipo, aunque la persona no la haya activado como cliente.
4. **La consola no lee tablas de hogares con `service_role` a la ligera.** Lee por funciones `security definer` en un
   schema `consola` que (a) revisan `private.tiene_permiso_staff(permiso)`, (b) devuelven agregados (conteos, sumas de
   cobros, uso) y nunca movimientos ni montos de un hogar, y (c) escriben en la auditoría cuando la acción es sensible.
   La `service_role` se queda en `/api/avisos` y los webhooks.
5. **Datos financieros solo con permiso**: `accesos_soporte (household_id, staff_id, motivo, aprobado_por, vence)`. El
   administrador del hogar aprueba desde un aviso en la app o por correo; mientras esté vigente, `private.mis_hogares()`
   incluye ese hogar para esa persona en modo solo lectura. Cada lectura se audita.
6. **Auditoría inmutable**: `auditoria (quien, accion, objeto, detalle jsonb, ip, creada)`, sin políticas de update ni
   delete. Se escribe desde las funciones de la consola, no desde el cliente.
7. **Límites por plan (entitlements)**: `planes (codigo, nombre, precio_mensual, precio_anual, limites jsonb, publicado)`
   y `private.limite(h, clave)`. Se aplican **en la base**: trigger al agregar miembros o invitaciones, `reservar_uso_ia`
   lee el tope del plan, Storage revisa el tamaño. En la interfaz se muestran como aviso con botón «Mejorar plan». Los
   precios se versionan (cambiar precio no cambia lo que paga un suscriptor actual hasta su renovación).
8. **Cobro con Wompi** (tarjeta, PSE, Nequi, Daviplata y Bancolombia en COP). **Decidido en S3:** cada periodo se paga
   con el Web Checkout (sin guardar datos de pago ni alcance PCI): 3 días antes del vencimiento se crea el cobro de
   renovación y se avisa por correo. Funciona igual para todos los medios (PSE y Daviplata no permiten débito
   automático). El débito automático con tarjeta o Nequi tokenizados queda como mejora. Webhooks firmados e
   idempotentes (`eventos_pasarela`). Stripe queda para tarjetas internacionales, después de la beta.
9. **Factura electrónica DIAN por un proveedor** (Alegra, Siigo, Factus u otro con API): la app manda los datos y guarda
   número, CUFE y PDF. Hace falta antes la razón social y la resolución de facturación.
10. **Eventos de producto** para analítica: `eventos (household_id, tipo, creado)` con pocos tipos (`registro`,
    `pagos_fijos_cargados`, `primer_gasto`, `invito_pareja`, `pago`, `cancelacion`), escritos por triggers o acciones.
    Cohortes y embudo salen de ahí y de `transactions` (conteos, no montos). Canal de llegada: UTM y código de
    referido guardados al registrarse (`households.canal`, `households.referido_por`).
11. **Feature flags** en una tabla (`funciones (clave, planes[], porcentaje, solo_equipo, activa)`); se leen junto al
    contexto del hogar y se cachean poco. El modo mantenimiento va en variable de entorno o Edge Config, no en la base:
    el proxy lo lee en cada request.
12. **Lo que no se construye**: página de estado y uptime (Better Stack, Instatus o similar), errores (Sentry),
    respaldos (plan Pro de Supabase). La pantalla Sistema los enlaza y muestra versión (`VERCEL_GIT_COMMIT_SHA`) y
    colas.

## 5. Roadmap por fases

Cada fase se puede desplegar sola y pasa a la siguiente cuando cumple su criterio. Las duraciones son estimadas para un
desarrollador con Claude Code.

### S0 · Despliegue y bases legales (1 semana + trámites)

Sin esto no se puede abrir el registro a terceros.

- Publicar en Supabase Cloud + Vercel (`docs/DESPLIEGUE.md`; lo único pendiente de la Fase 1).
- Términos y condiciones, política de tratamiento de datos (Ley 1581) y aviso de privacidad; casillas al registrarse:
  aceptar política (obligatoria) y recibir comunicaciones comerciales (opcional) → `consentimientos (user_id, tipo,
  version, aceptado, ip)`.
- Correo `datos@…` como canal de solicitudes de titulares mientras no exista la pantalla 16.
- Trámites del usuario: razón social o persona natural con RUT, cuenta Wompi, proveedor de factura electrónica.

**Criterio:** la app corre en producción con dominio propio y nadie se registra sin aceptar la política.

### S1 · Consola: acceso, equipo y auditoría (2 semanas) — pantallas 1, 15, 16 (parte de auditoría) · ✅ hecha

- Migración: `platform_staff`, `permisos_staff` (matriz fija en SQL), `auditoria`, claim `staff_rol` en el hook.
- `/consola/ingresar` (pantalla 1): mismo flujo de contraseña + TOTP, AAL2 obligatorio, registro de cada ingreso.
  «Confiar 12 h» = cookie firmada; la llave de seguridad (WebAuthn) queda para cuando Supabase la soporte en MFA.
- Layout de la consola: barra lateral, franja de entorno, búsqueda global (por ahora hogares y usuarios).
- Equipo y permisos: invitar, cambiar rol, desactivar; cierre por inactividad (30 min) en la consola.
- Registro de auditoría (lectura y exportación). Script `scripts/crear-superadmin.mjs` para el primer acceso.
- Pruebas RLS: un staff sin permiso no ve nada; un miembro de hogar no entra a `/consola`; la auditoría no se edita.

**Criterio:** tú entras a la consola con 2FA, invitas a otra persona con rol Soporte y cada acción queda auditada.

### S2 · Planes y límites, sin cobro todavía (2 semanas) — pantallas 4, 5, 6, 8 (sin cupones) · ✅ hecha

- Migración: `planes` (sembrar Gratis, Familia, Contador con los límites del diseño), `households.plan` pasa a FK,
  `households.estado` (`activo`, `prueba`, `suspendido`, `supresion_pedida`), `prueba_hasta`.
- `private.limite()` y su uso: miembros por plan, comprobantes con IA al mes (en `reservar_uso_ia`; el tope técnico por
  hora se queda contra abusos), almacenamiento, funciones (pronóstico, renta, WhatsApp).
- **Lado del hogar** (no está en el lienzo, hay que diseñarlo): Configuración → Plan con uso y límites, aviso al
  llegar a un tope y prueba de Familia por 14 días sin tarjeta.
- Consola: Hogares (lista con filtros, paginada por cursor), Detalle de hogar (uso, miembros, historial, notas
  internas, suspender), Usuarios (cerrar sesiones y restablecer 2FA con la API de admin de Auth, auditados; correos
  enmascarados), Planes (editar límites y publicar con historial).

**Criterio:** cambiar un límite en la consola cambia lo que un hogar puede hacer, y la base lo hace cumplir aunque se
salte la interfaz.

### S3 · Cobro y facturación (3 semanas) — pantallas 7, 8 (cupones), 5 (facturas, reembolso) · ✅ hecha (falta proveedor de factura)

- Migración: `suscripciones`, `cobros`, `facturas`, `cupones`, `cupones_usos`, `eventos_pasarela`.
- Wompi: checkout, tokenización de tarjeta y Nequi, enlace de pago para PSE/Daviplata, webhook `/api/pagos/wompi`
  (firma, idempotencia), cobro de renovaciones en el cron diario.
- Mensual y anual, cupones (%, meses gratis, usos, vencimiento, programados), IVA incluido y discriminado.
- Recuperación de pagos fallidos: día 0 correo + reintento, día 3 segundo aviso (WhatsApp cuando exista; mientras,
  correo), día 7 reintento + banner en la app, día 14 pasa a Gratis sin perder datos.
- Factura electrónica con el proveedor elegido; nota crédito al reembolsar.
- Consola: Suscripciones y cobros, conciliación, reembolsos y cambio de plan (rol Finanzas), cupones.
- Correos nuevos con el diseño de marca: pago recibido, pago fallido, plan cambiado, prueba por terminar.

**Criterio:** un hogar paga Familia con tarjeta, PSE y Nequi en el sandbox de Wompi; un fallo recorre la secuencia y
baja a Gratis el día 14; cada cobro tiene su factura.

### S4 · Métricas y comunicaciones (2 semanas) — pantallas 2, 3, 14 · ✅ hecha (pendientes: CAC por canal, campañas por WhatsApp y aviso en la app)

- `eventos`, canal y referido al registrarse (UTM), funciones de agregados para KPIs (MRR, ARPU, churn, conversión),
  embudo, cohortes y adquisición. CAC: la inversión por canal se carga a mano por mes.
- Panel general con alertas calculadas (pagos fallidos, tickets urgentes, UVT del año siguiente sin cargar, precisión
  de IA bajo la meta) y actividad reciente desde la auditoría y los eventos.
- `correos_enviados` + webhooks de Resend (entregado, abierto, clic, rebote) → métricas por plantilla.
- Campañas: segmento (consulta guardada), canal correo y aviso en la app, programación, envío de prueba; solo a quien
  aceptó comunicaciones; enlace para darse de baja en cada correo.

**Criterio:** el panel general muestra cifras reales del entorno de producción y una campaña llega solo a quien aceptó.

### S5 · Contadores (3 semanas) — pantalla 9 y el plan Contador · ✅ hecha (pendientes: descarga masiva de soportes y recordatorios masivos)

- Selector de hogares en la app (reemplaza la decisión 14): el JWT trae el hogar activo y cambiarlo refresca la sesión.
- `organizaciones_contables` (la firma, sus personas, hasta 30 hogares clientes), solicitud y verificación con tarjeta
  profesional, invitación a hogares o enlace de referido.
- Panel del contador (no está en el lienzo, hay que diseñarlo): clientes, semáforo DIAN de cada uno, descarga masiva de
  soportes, recordatorios masivos.
- Comisiones: 20 % de lo que pagan los hogares referidos, liquidación mensual, marcar como pagada.

**Criterio:** una contadora ve a sus 3 clientes de prueba en un solo panel, y su comisión se calcula sola.

### S6 · Contenido y parámetros (2 semanas) — pantallas 11, 12, 13 · ✅ hecha (pendientes: tasa de error por formato de extracto, plantillas de WhatsApp y flujos n8n)

- Parámetros DIAN: UVT por año con fuente y estado, topes, etiquetas, `calendario_tributario (pais, anio, digitos,
  fecha)` y avisos 60/30/7 días antes de la fecha de cada persona (pide los dos últimos dígitos de la cédula). Antes
  de diciembre de 2026 la UVT 2027 se puede cargar con una migración si esta fase no ha llegado.
- Catálogos: `categorias_base` (reemplaza la lista fija de `sembrar_categorias`), `reglas_comercio_globales` (se
  aplican antes que la IA; las del hogar tienen prioridad), `formatos_extracto` (encabezados y mapeo por banco, que el
  importador usa para detectar el formato).
- IA: configuración global (umbral de confianza, hoy 70 en código; el diseño propone 90), tope de gasto mensual que
  frena las lecturas, costo por lectura (tokens guardados en `ia_usos`), precisión = lecturas cuya categoría el usuario
  no cambió.

**Criterio:** la UVT, una regla de comercio o el umbral de la IA se cambian desde la consola sin desplegar.

### S7 · Soporte y privacidad (2 semanas) — pantallas 10, 16 y el permiso de la 5 · ✅ hecha (pendiente: tickets por correo entrante)

- Tickets: el hogar escribe desde la app («Ayuda») o por correo; prioridad, SLA, asignación, respuestas guardadas,
  notas internas, escalar. Registro técnico: los errores de importación y de IA del hogar.
- Acceso de soporte con permiso (decisión 4.5): pedir, aprobar, vencer y auditar.
- Ley 1581: solicitudes con plazo en días hábiles (festivos de Colombia), exportación de los datos del titular
  (JSON + CSV + soportes), supresión completa (hogar en cascada, archivos de Storage y cuentas de Auth sin otro hogar)
  y retención de 90 días tras cancelar.

**Criterio:** una solicitud de supresión se atiende de punta a punta desde la consola y deja rastro en la auditoría.

### S8 · Sistema (1 semana) — pantalla 17 · ✅ hecha (Sentry y página de estado: enlaces por variable de entorno)

- Feature flags por plan, porcentaje (hash estable del hogar) o solo equipo.
- Modo mantenimiento, versión en producción, colas (comprobantes, correos), enlace a Sentry y a la página de estado.

**Criterio:** una función nueva se enciende para el 10 % de los hogares sin desplegar.

### Fuera de este roadmap

- **WhatsApp y n8n** (pantallas 7 y 13 los muestran): son su propia fase (registro por WhatsApp, plantillas aprobadas por
  Meta). Mientras tanto, esas partes de la consola muestran «No conectado».
- **Stripe y USD**, **módulo IRS** (el selector de país de la pantalla 11 queda preparado por el registro de
  jurisdicciones), **modo oscuro** (hoy la app es solo modo claro), **roles personalizados** («Nuevo rol»).

## 6. Orden y dependencias

```
S0 despliegue y legal ─► S1 consola y equipo ─► S2 planes ─► S3 cobro ─► S4 métricas
                                                     │                      ▲
                                                     └──► S5 contadores ────┘
S1 ─► S6 contenido      S1 ─► S7 soporte y privacidad      S1 ─► S8 sistema
```

Ruta mínima para la beta paga: **S0 → S1 → S2 → S3** (unas 8 semanas). S4 conviene antes de invertir en pauta. S5 abre
el canal de contadores, el de mejor conversión según el diseño. S6–S8 reemplazan trabajo manual y se pueden
intercalar.

## 7. Decisiones abiertas

| Pregunta | Recomendación |
| --- | --- |
| ¿El plan Gratis incluye Renta DIAN? El diseño la apaga, pero es el diferencial del producto | Gratis con el semáforo DIAN visible; el reporte anual y la carpeta de soportes en Familia |
| Roles del hogar: el diseño dice «Pareja»; la app usa admin / editor / contador | «Pareja» como etiqueta de `editor`, sin rol nuevo |
| «Comprobantes ilimitados» en Familia | Ilimitados en la interfaz, con el tope técnico por hora y por día contra abusos |
| Pasarela | Wompi en la beta; Stripe cuando haya clientes fuera de Colombia |
| Proveedor de factura electrónica | Elegir uno con API y sandbox (Alegra o Factus) antes de S3 |
| Soporte propio o herramienta externa | Propio y simple (S7): el diseño lo integra con el hogar y la auditoría |
| Pantallas sin diseño: plan y pago en la app del hogar, panel del contador, «Ayuda» | Diseñarlas en el lienzo antes de S2, S5 y S7 |
