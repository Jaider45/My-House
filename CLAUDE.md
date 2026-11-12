@AGENTS.md

# My House — finanzas familiares

WebApp (PWA) para que un hogar registre ingresos y gastos, conozca su costo de vida, y llegue a la
declaración de renta con todo ordenado. MVP para una familia; arquitectura multi-tenant (SaaS) desde el día uno.

**Fase actual: SaaS** (rama `feat/saas`). Abrir la app a muchas familias y contadores, con planes, cobro y una consola
para el equipo de My House. Objetivo, pantallas, arquitectura y fases S0–S8 en `docs/ROADMAP-SAAS.md` (diseños:
sección Admin SaaS del lienzo «My House — Pantallas webapp», `project/Admin*.dc.html`).

- Interfaz en español, locale `es-CO`, moneda COP, miles con punto (`$ 1.234.567`). Zona horaria `America/Bogota`.
- Jurisdicción tributaria inicial: Colombia (DIAN). El módulo tributario es intercambiable por país (`src/lib/impuestos`).

## Stack
- Next.js 16 (App Router, `cacheComponents: true`) + React 19 + TypeScript estricto + Tailwind v4.
- Supabase: Postgres, Auth (email + TOTP), Storage (bucket `soportes`). Cliente: `@supabase/ssr`.
- Validación `zod`. CSV con `papaparse` (en el navegador). Pruebas con Vitest.

## Comandos
| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | lint + typecheck + pruebas unitarias (correr antes de cada commit) |
| `npm test` | Pruebas unitarias (`src/**/*.test.ts`) |
| `npm run test:rls` | Pruebas de aislamiento contra Supabase local (`tests/rls`). Requiere `npm run db:start` y `.env.local` |
| `npm run db:start` / `db:stop` | Supabase local (Docker), sin Studio/realtime/logs para ahorrar disco |
| `npm run db:reset` | Recrea la BD local aplicando migraciones + `supabase/seed.sql` |
| `npm run db:types` | Regenera `src/lib/supabase/database.types.ts` |
| `npx supabase migration new <nombre>` | Nueva migración versionada |

## Estructura
- `supabase/migrations/` — esquema versionado. Nunca editar una migración ya aplicada en la nube: crear otra.
- `src/app/(auth)` pantallas públicas; `src/app/(app)` pantallas autenticadas; `src/app/onboarding` crear hogar.
- `src/lib/dinero` formateo/parseo COP · `src/lib/finanzas` costo de vida y número mínimo ·
  `src/lib/importacion` CSV y duplicados · `src/lib/impuestos` jurisdicciones (`co/`) ·
  `src/lib/ingesta` punto único para crear movimientos (manual, CSV, recurrente; luego OCR/WhatsApp/banco) ·
  `src/lib/ia` lectura con IA (Claude u OpenAI) · `src/lib/hogar` configuración y personas a cargo ·
  `src/lib/cola` registros sin conexión · `src/lib/correo` diseño y envío de correos · `src/lib/avisos` avisos
  programados por correo.
- Pruebas unitarias junto al código (`*.test.ts`); pruebas RLS en `tests/rls`.

## Convenciones
- **Dinero**: `bigint` en BD, pesos enteros, `monto > 0`; el signo lo da `tipo`. En TS se maneja como `number` entero
  (seguro hasta 9e15). Nunca `float` para montos ni divisiones sin redondear con `Math.round`.
- **Multi-tenant**: toda tabla de negocio tiene `household_id` + RLS. Las referencias entre tablas usan FK compuesta
  `(id, household_id)` para que no se pueda apuntar a filas de otro hogar.
- Helpers RLS en schema `private`: `private.mis_hogares()`, `private.tiene_rol(h, roles)`.
- Roles: `admin` (todo, gestiona miembros), `editor` (escribe datos), `contador` (solo lectura).
- Lectura de sesión (`cookies()`) siempre detrás de `<Suspense>` (exigencia de Cache Components).
- Datos financieros no se cachean con `use cache`: frescura > velocidad.
- Código y nombres de dominio en español (tablas del modelo en inglés porque así se definieron); commits en español.
- Topes tributarios se guardan en UVT; los pesos se calculan (`uvt × tope`), nunca se guardan fijos.

## Decisiones (lo no especificado, elegido por simplicidad)
1. Montos `bigint` en pesos. Monedas con centavos (SaaS) se guardarían en unidades mínimas.
2. Semáforo DIAN **por persona** (miembro adulto), porque los topes son por persona natural. Atribución:
   `transactions.member_id`, o el titular de la cuenta (`accounts.titular_member_id`).
3. Campos extra al modelo: `members.user_id` nullable (dependientes sin acceso); `categories.clase` (gasto/ingreso),
   `excluir_de_costo_vida`; `transactions.cuenta_destino_id/estado/origen/import_hash/import_batch_id`;
   `attachments.household_id`; `recurring_rules.account_id/fecha_inicio/ocurrencias/activa`;
   tablas `invitations` e `import_batches`; `households.config` (`cuota_imprevistos_pct`, por defecto 10).
4. Invitación: enlace copiable y, si hay por dónde enviar, también por correo (ver 30).
5. Contador = solo lectura.
6. 2FA TOTP opcional por usuario; si está activa se exige AAL2 en cada ingreso.
7. Recurrentes: pg_cron diario genera movimientos `programado` hasta 7 días adelante; el usuario los confirma.
   Fecha n = `fecha_inicio + n·periodo` (evita que el día 31 se corra). Quincenal = cada 15 días.
   La programación arranca en la primera ocurrencia desde hoy (no se crean pagos pasados). Al editar, pausar o
   reactivar una regla se borran sus programados futuros y se regeneran. `src/lib/recurrentes` replica en TS la
   fecha del SQL; `tests/rls/recurrentes.test.ts` verifica que coincidan.
   Cuidado con Cache Components: en una página, llamar `obtenerContexto()` antes de `hoy()`.
8. `tax_tags.renglon_formulario` vacío hasta validarlo contra el formulario 210 del año.
9. Pago de tarjeta = transferencia banco → tarjeta; el gasto cuenta cuando se compra.
10. Patrimonio bruto del semáforo = saldos de cuentas del titular (no incluye inmuebles/vehículos: limitación conocida).
    Semáforo: verde < 70 %, amarillo 70–99 %, rojo ≥ 100 % del tope; el porcentaje se trunca. Consignaciones =
    ingresos a cuentas banco + transferencias recibidas en banco (puede sobrestimar; es lo prudente).
    Módulo por país: `src/lib/impuestos/tipos.ts` (contrato), `registro.ts` (países), `co/` (Colombia).
    Para agregar un país: implementar `JurisdiccionTributaria`, registrarlo y sembrar `tax_params`/`tax_tags`.
11. Costo de vida y número mínimo (`resumirMes`, cálculo puro en `src/lib/finanzas`), por categoría raíz y sin las
    categorías `excluir_de_costo_vida`. En el mes en curso se usa el **plan** (`armarPlan` en `src/lib/presupuesto`,
    cargado con `cargarPlan`): presupuesto = equivalente mensual de los pagos fijos activos + gasto variable presupuestado.
    Antes se medía solo con movimientos y los pagos fijos aún no programados (se programan 7 días antes) no contaban.
    - Costo de vida = Σ max(presupuesto, confirmado + programado). Meses cerrados: lo gastado. Lo sin categoría cuenta
      como variable no esencial. Costo por persona divide entre todos los miembros (con dependientes).
    - Fijos = max(pagos fijos del plan, lo gastado si la categoría es de tipo fijo); variables = el resto.
    - Número mínimo = Σ categorías esenciales max(presupuesto, promedio de los 3 últimos meses cerrados con gastos
      categorizados —si no hay, el mes actual—, fijos) + cuota de imprevistos (% sobre esa suma).
    - Ingresos esperados = max(confirmados + programados, ingresos fijos del plan); ahorro proyectado = ingresos
      esperados − costo de vida. Pagos pendientes = programados + ocurrencias del mes que aún no se programan.
12. Next 16 con `cacheComponents` activo (será obligatorio en la próxima versión mayor).
13. `@types/node@24` (coincide con Node 24 y lo exige Vitest 5).
14. Cada usuario opera un hogar a la vez: el elegido en `hogar_activo` (selector de S5; aparece con más de un
    hogar) o, si nunca eligió, el primero al que entró. Cambiarlo llama `elegir_hogar` + `auth.refreshSession()`.
15. Velocidad: el JWT trae el hogar, el miembro y el rol (`public.custom_access_token_hook`, activado en
    `config.toml` y en el panel de Supabase Cloud). `obtenerContexto()` los lee con `getClaims()` (verificación local
    con la llave pública, sin red) y solo consulta la base si el token no los trae. Tras crear hogar, aceptar
    invitación o editar hogar/rol propio se llama `auth.refreshSession()`. Vercel en `iad1`, junto a Supabase (`us-east-1`).
    `crearClienteServidor()` llama `await connection()`: todo lo que toca Supabase se renderiza por request
    (supabase-js usa `Date.now()` y Cache Components lo rechaza en prerender).
    Navegación: `staleTimes.dynamic: 30` reutiliza en el navegador lo visitado hace < 30 s. Toda acción que guarda
    debe llamar `revalidatePath` (vacía esa caché).
    **Las páginas no llevan `<Suspense>` propio**: el único está en `(app)/layout.tsx` (cubre la carga directa). Al
    navegar, React deja la pantalla anterior hasta que la nueva llega (~80–200 ms) con una barra fina
    (`useLinkStatus` en `navegacion.tsx`). Con esqueleto por página React lo retiene ≥ 300 ms aunque los datos
    lleguen en 40 ms (medido: 315 → ~100 ms). Por eso `instantInsights.validationLevel: "manual-warning"`.
    `src/components/marca.tsx` es componente de cliente: si los SVG se arman en el servidor, sus trazos (~150 KB)
    viajan en los datos de cada pantalla.
    Desarrollo: `next dev` en el disco G: (HDD) es 5–10× más lento que producción; para sentir la velocidad real,
    `npm run build && npm start`.
16. Autoría (`created_by`, `creada_por`) la fija un trigger con `auth.uid()`; el cliente no puede falsearla.
    `npm audit` en CI solo para producción: el tooling de ESLint arrastra `minimatch` <11 sin arreglo compatible.
17. Sesión y 2FA se chequean en `src/proxy.ts` (optimista, leyendo el JWT; ver 29); la autorización real es RLS.
    `obtenerContexto()` (`src/lib/sesion.ts`) es la capa de acceso: usuario + miembro + hogar por request.
18. PWA sin librerías: `src/app/manifest.ts` + `public/sw.js` escrito a mano. El SW no guarda páginas ni datos
    (información financiera); solo estáticos con hash y la página `/sin-conexion`. Solo se registra en producción.
    Íconos: `node scripts/generar-iconos.mjs` (usa `sharp`, que ya trae Next).
19. Cuentas y categorías con movimientos no se borran: se archivan (borrar una cuenta borraría su historia en
    cascada). En tarjetas, el "saldo inicial" se captura como deuda y se guarda negativo.
20. Importación CSV: se parsea en el navegador (UTF-8, o Windows-1252 si hay caracteres dañados), se detecta
    el encabezado y se recuerda el mapeo por cuenta. Huella = sha256(cuenta|fecha|tipo|monto|descripción
    normalizada|n-ésima repetición en el archivo), recalculada en el servidor. "Posible duplicado" = movimiento
    no importado de igual tipo y monto a ±2 días (se presenta desmarcado). Lo importado puede quedar sin
    categoría; se sugiere la de comercios ya categorizados. Deshacer = borrar el lote (cascada).
    Extractos de ejemplo: `node scripts/generar-extractos.mjs` → `docs/ejemplos/`.
21. Diseño visual: sistema "My House" (lienzo de pantallas en claude.ai). Tokens en `src/app/globals.css` (`@theme`:
    `monte`, `teja`, `arena`, `pagina`, `elevada`, `tinta`, `cuerpo`, `tenue`, `ok/alerta/error` + `-fondo`/`-tinta`),
    fuente Figtree, solo modo claro. Íconos y logo en `src/components/marca.tsx` (datos generados en `marca-datos.ts`;
    el ícono de categoría sale de `src/lib/categorias/iconos.ts`). Tamaños: celular < 768 (barra inferior + botón
    flotante), laptop ≥ 1024 (barra lateral colapsada), escritorio ≥ 1440 (`xl`, barra lateral completa).
    Los componentes de `src/components/ui` ya traen los estilos: no usar colores de Tailwind (`zinc`, `teal`…).
    Cuidado: dos utilidades de la misma propiedad en un elemento (p. ej. `hidden` + `inline-flex` de `clasesBoton`)
    no se resuelven por orden; envolver en un `<span className="hidden lg:contents">` o usar `!`.
22. Módulos (migración `modulos`): presupuesto = pagos fijos de la categoría + gasto variable (`budgets_goals` tipo
    `presupuesto`, en la interfaz «Gasto variable», se repite cada mes). Los pagos fijos se crean también desde
    Presupuesto (mismo `FormularioRegla` de Pagos fijos); el onboarding admite hasta 10 pagos extra con categoría; pronóstico de cierre = max(real + programado, fijos) + ritmo del gasto variable
    (`src/lib/presupuesto`). Deudas (`debts`): pagado = `pagado_inicial` + movimientos con `debt_id`; un abono es un
    gasto en Deudas. Metas (`budgets_goals` tipo `meta`): ahorrado = `ahorrado_inicial` + movimientos con `goal_id`
    (gasto en «Ahorro e inversión», fuera del costo de vida). Recordatorios guardan fechas y canales; el correo ya se
    envía (ver 30); WhatsApp y notificación quedan guardados hasta que se conecten esos servicios.
23. IA (`src/lib/ia`, salida estructurada con Zod): el asistente de comprobantes lee fotos, PDF o texto;
    `src/lib/comprobantes` decide (registrar, revisar o descartar; confianza mínima 70; reglas aprendidas por comercio
    en `merchant_rules`). Duplicado = mismo tipo y monto a ±2 días: se adjunta como soporte en lugar de crear otro
    movimiento. Los extractos en PDF se convierten en filas (fecha, descripción, valor) que el importador trata como
    CSV. Las fotos se comprimen a 1600 px en el navegador antes de subirlas.
    **Proveedores**: Anthropic (`anthropic.ts`, streaming + `fallbacks: "default"`, `effort: low` solo en Opus/Sonnet)
    y OpenAI (`openai.ts`, Responses API, `zodTextFormat` estricto, `store: false`). Mismo contrato
    (`pedirEstructurado`), mismos esquemas y textos (`esquemas.ts`). Llaves solo en el servidor (`ANTHROPIC_API_KEY`,
    `OPENAI_API_KEY`); sin ninguna la app avisa y lo demás funciona. El hogar elige proveedor y modelo (texto libre
    con sugerencias) en `households.config.ia`; `resolverIa` (`proveedores.ts`): elección del hogar si su proveedor
    tiene llave → `IA_PROVEEDOR` → el primero con llave; modelo: el del hogar → `*_MODEL` → por defecto
    (`claude-opus-5-5`, `gpt-6.1-sol`). Errores de API se traducen en `explicarError` (llave, modelo inexistente…).
    Pruebas de adaptadores con los SDK reales contra un servidor falso local (`OPENAI_BASE_URL`/`ANTHROPIC_BASE_URL`).
24. Datos de prueba: `node scripts/sembrar-demo.mjs` crea el hogar de demostración (andres@ y camila@myhouse.test,
    clave de las pruebas RLS) con 12 meses de movimientos y dos personas a cargo. Solo contra Supabase local.
25. Contexto del hogar: `households.config` se lee con `leerConfigHogar` y se escribe con `fusionarConfigHogar` (nunca
    reemplazar el jsonb entero: borraría la configuración de otra pantalla). `config.contexto` (texto libre, ≤ 600)
    y las personas a cargo (`members` con `parentesco`, `fecha_nacimiento`, `a_cargo_de`, `nota`,
    `dependiente_dian`) se resumen con `describirHogar` en el texto de sistema del asistente.
    DIAN: la jurisdicción expone `dependientes` (opcional): orientación por parentesco/edad (art. 387 E.T.) y topes de
    la deducción desde `tax_params.deducciones` en UVT (10 % hasta 384 UVT/año; 72 UVT adicionales por dependiente,
    máx. 4). Es orientativo: no se resta de nada ni cambia el semáforo.
26. Registro sin conexión: si no hay red al guardar en `/rapido`, el registro queda en `localStorage`
    (`src/lib/cola`, máx. 50) y `ColaSinConexion` (en el layout) lo envía con `registrarRapido` al volver la señal o al
    abrir la app. Lo que el servidor rechaza queda visible para descartarlo. Solo funciona con la pantalla ya abierta:
    el SW no guarda páginas. Sin duplicados: cada registro lleva `clave` (UUID de `nuevaClave`, que funciona también
    por http en la red local) que se guarda en `transactions.client_id` con `unique (household_id, client_id)`; si la
    respuesta se perdió y la cola lo reenvía, el choque se responde como «guardado».
27. Trato: toda la interfaz tutea («tú»), como el diseño.
28. Acciones de servidor: además de RLS, cada acción que escribe revisa `puedeEditar`/`esAdmin` y devuelve un mensaje
    (RLS sin permiso actualiza 0 filas sin error, y la acción reportaría éxito). Parámetros de URL que van a filtros
    de PostgREST (`or(...)`) se validan como UUID antes.
    Toda acción devuelve `Estado` (nunca `return;` mudo): permiso primero (`SOLO_LECTURA`/`SOLO_ADMIN`, sin tocar la
    base), id con `idDe(datos)` y `.select("id")` en el mismo `update`/`delete` para detectar 0 filas (`NO_ENCONTRADO`),
    todo en `src/lib/acciones.ts`. Los botones sueltos de las páginas de servidor (archivar, pausar, confirmar…) usan
    `FormularioAccion` (`src/components/ui/formulario-accion.tsx`): `useActionState` y el error junto al botón.
    Presupuesto: `guardar_presupuesto(p_hogar, p_items)` (RPC `security invoker`, todo o nada; el upsert de supabase-js
    no sirve con el índice parcial). El formulario solo envía las categorías que cambiaron.
    Cupo de IA: `reservar_uso_ia` (security definer, candado por hogar) antes de llamar al modelo, en paralelo con la
    preparación: 30 lecturas por persona y hora, 150 por hogar y día (topes en el SQL); `ia_usos` sin políticas de
    escritura para que nadie recargue su cupo.
29. Contraseñas: `CampoContrasena` (`src/components/ui`) con botón para verla (se oculta al enviar, para que el navegador
    ofrezca guardarla), aviso de Bloq Mayús y medidor orientativo (`src/lib/contrasena`); el valor vive en el componente
    porque React vacía los campos no controlados tras cada acción. Recuperación: `/recuperar` → correo de Supabase →
    `/auth/confirmar` → `/nueva-contrasena` (responde igual exista o no la cuenta). No se pide la contraseña actual si el
    JWT trae `amr` `recovery` u `otp` de hace < 1 h (`verificoCorreoHacePoco`: ya demostró que controla el correo); si
    no, se compara en la base con `verificar_contrasena_actual` (RPC, pausa 1 s al fallar; no abre otra sesión ni pasa
    por el captcha). Al cambiarla, casilla marcada «cerrar sesión en mis otros dispositivos» (`signOut({scope:"others"})`).
    Una acción envuelta en una función propia de `useActionState` no puede hacer `redirect()`: la navegación queda
    pendiente para siempre; ahí navega el cliente.
    Ingreso: contraseña, código de 6 dígitos al correo (`signInWithOtp` con `shouldCreateUser: false` + `verifyOtp`; la
    plantilla *magic link* muestra `{{ .Token }}`) o Google (botón solo con `NEXT_PUBLIC_GOOGLE_ACTIVO=1`). Tras abrir
    sesión, la acción manda a `/mfa` si hace falta (`destinoTrasIngreso`): la redirección de una acción se renderiza en
    la misma petición sin pasar por el proxy, y antes mostraba la primera pantalla sin el código.
    2FA en el proxy: el JWT trae `mfa_activa` y `aal`; solo los tokens viejos (sin el claim) consultan a Auth.
    Captcha: Cloudflare Turnstile (`src/components/ui/captcha.tsx`), token en el campo `captcha`, se reinicia tras cada
    intento. Apagado en local (`config.toml`); en la nube se activan juntos Supabase (secreta) y
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Probado con las llaves de prueba de Cloudflare.
    Correos: plantillas en español en `supabase/templates/` (también se pegan en el panel de la nube); SMTP propio
    (Resend) solo en la nube. Pasos en `docs/DESPLIEGUE.md` §1.1–1.4.
    Subidas: `src/proxy.ts` pasa por todas las rutas y Next solo copia `proxyClientMaxBodySize` (10 MB por defecto) del
    cuerpo: debe ser ≥ `serverActions.bodySizeLimit` (30 MB), o la acción falla con "Unexpected end of form".
30. Correos (diseño «Email» del lienzo «My House — Pantallas webapp» en claude.ai): `src/lib/correo/plantilla.ts` arma
    HTML para clientes de correo (tablas y estilos en línea: Gmail/Outlook ignoran flex y grid; media query para
    celular) + texto plano + vista previa oculta. Logo e íconos en PNG (los clientes bloquean SVG) en
    `public/correo/`, generados con `node scripts/generar-imagenes-correo.mjs`. `correos.ts` tiene un constructor
    por tipo (código, restablecer, registro, cambio de correo, contraseña cambiada, bienvenida, invitación, contador,
    nuevo inicio de sesión, recordatorio, vencido, resumen, DIAN, reporte). Vista previa: `/dev/correos` (en
    producción 404 salvo `VISTA_CORREOS=1`).
    **Supabase** envía los de acceso (en la nube se suben con `node scripts/subir-correos-supabase.mjs`: plantillas,
    asuntos, vigencia y SMTP Resend; token en `.env.produccion.local`): `supabase/templates/*.html` se GENERAN desde `src/lib/correo/supabase.ts` con
    variables de Go como texto crudo (`crudo("{{ .Token }}")`); `plantillas-supabase.test.ts` falla si se
    desincronizan (regenerar con `ACTUALIZAR_CORREOS=1 npx vitest run src/lib/correo`). Vigencia 30 min
    (`otp_expiry = 1800` = `MINUTOS_OTP`). Saludo con `{{ .Data.nombre }}`; el código se parte con `slice`.
    **La app** envía el resto con `enviarCorreo` (`enviar.ts`): Resend si hay `RESEND_API_KEY`; si la base es local,
    Mailpit (`/api/v1/send`); si no, no envía. Nunca rompe la acción que lo pidió.
    Disparadores: bienvenida al terminar el paso 2 del onboarding («Omitir» también pasa por la acción; una sola vez:
    `config.correo.bienvenida_enviada`; número mínimo = fijos + cuota de imprevistos); invitación y contador al
    invitar; «¿Fuiste tú?» al entrar desde un navegador sin la cookie `mh_dispositivo` (httpOnly, huellas de hasta 5
    usuarios; no avisa a cuentas de < 15 min ni al abrir el enlace de recuperación).
    Programados (`/api/avisos`, Vercel Cron diario 12:00 UTC = 7:00 Bogotá, `Authorization: Bearer CRON_SECRET`,
    llave service_role solo ahí): `planificarAvisos` (puro, `src/lib/avisos`) decide recordatorios con canal correo
    (en los días de anticipación elegidos), pagos programados vencidos ayer (si la regla tiene `recordar`), resumen de
    los lunes (si el admin lo activó en Recordatorios: `config.correo.resumen_semanal`) y Renta DIAN (una vez por
    persona y año al alcanzar un tope; usa `cargarSemaforo`). Destinatarios: admin y editor (no contador).
    `avisos_enviados` (RLS sin políticas) guarda la clave de cada aviso: se reserva antes de enviar y se libera si no
    salió ninguno. `?hoy=` simula la fecha fuera de producción o con `AVISOS_SIMULAR_FECHA=1`.
    Escala: hogares por páginas (`?desde=` cursor por id, 100 por página), reserva de todas las claves en un `upsert`
    con `ignoreDuplicates`, envío a `AVISOS_CORREOS_POR_SEGUNDO` (2), correos de Auth con `correos_de_usuarios`
    (solo service_role) en vez de `listUsers`. Con poco tiempo restante libera lo no enviado y se vuelve a llamar con
    `after()` (máx. 30 vueltas); es idempotente. El secreto se compara con `timingSafeEqual`.
    Falta: el reporte para el contador (solo diseño) y WhatsApp/notificaciones.
31. Seguridad web (docs/mejoras.md): CSP fija en `next.config.ts` **sin nonce** (rompería el prerender parcial), en
    `Report-Only` hasta poner `CSP_MODO=activa`. `robots.ts` + `metadata.robots` noindex (app privada; `robots.txt`
    excluido del proxy). `global-error.tsx` con estilos en línea, sin `PaginaEstado` ni `marca.tsx`.
    `papaparse` se carga con `import()` al acercarse al selector de archivo (`/importar` pesa ~19 KB menos).
    `globals.css` excluye `.claude/` de Tailwind (`@source not`): un enlace a skills fuera del proyecto rompía el build.
32. JS del navegador (skill `vercel-react-best-practices`, docs/MEJORAS.md 11–15): un componente `"use client"` solo
    importa de `src/lib` módulos livianos. Constantes que conviven con zod/supabase se separan (`src/lib/hogar/constantes.ts`);
    si no, el navegador descarga la librería entera (zod ~107 KB, supabase-js ~260 KB). El 2FA (`/mfa`,
    Seguridad) usa acciones de servidor, no `crearClienteNavegador`. Consultas independientes de una página van en
    `Promise.all` (Movimientos arranca catálogos y movimientos juntos). Medir: suma de chunks de
    `.next/server/app/<ruta>/page_client-reference-manifest.js` tras `npm run build`.
33. Consola del equipo (`/consola`, SaaS S1; migración `consola`). El equipo de My House (`platform_staff`, roles
    `superadmin`/`soporte`/`finanzas`/`contenido`) NO es miembro de ningún hogar. Todo pasa por funciones `consola_*`
    (security definer) que llaman `private.exigir_staff(permiso)`: persona activa + **AAL2 exigido en la base** + permiso
    de la matriz `private.permisos_de_rol` (réplica en `src/lib/consola/permisos.ts`; `tests/rls/consola.test.ts` verifica
    que coincidan). Tablas sin políticas de escritura; las funciones devuelven datos del equipo y agregados, nunca
    movimientos ni montos de un hogar. `auditoria` es inmutable (trigger bloquea update/delete/truncate, también a
    service_role); `private.auditar` guarda IP y navegador de las cabeceras `x-mh-ip`/`x-mh-agente`, que manda
    `crearClienteConsola()`. El JWT trae `staff: {rol, nombre}` (hook) solo para el chequeo optimista del proxy;
    `obtenerStaff()` relee la fila propia en cada request (desactivar corta el acceso en el siguiente clic).
    Proxy: sin sesión → `/consola/ingresar`; cliente → `/`; equipo sin AAL2 → código o `/consola/dos-pasos` (2FA
    obligatoria); 30 min sin abrir pantallas de la consola (cookie `mh_consola_actividad`, path `/consola`) →
    `/consola/salir?motivo=inactividad`. El ingreso termina en `entrar()` (`src/lib/consola/ingreso.ts`: registra
    `ingreso_consola` y reinicia la cookie). Invitaciones: token en el enlace, en la base solo su sha256; se acepta con
    el mismo correo. Primer superadmin: `node scripts/crear-superadmin.mjs correo "Nombre"` (service_role).
    No hechos del diseño: «confiar en este equipo 12 h» (bajaría a AAL1), llave de seguridad (WebAuthn), IP permitidas.
34. Planes y límites (SaaS S2; migración `planes`). `planes` (precios con IVA, `limites` jsonb: personas,
    comprobantes_mes —null = ilimitados—, almacenamiento_mb, metas, renta_reporte, whatsapp; claves del plan Contador
    para S5) y `plataforma_config` (prueba_dias, descuento_anual_visible, iva_incluido). **La base hace cumplir**:
    triggers en `invitations`/`members` (personas = miembros con usuario + invitaciones vigentes; dependientes no
    cuentan), `budgets_goals` (metas), política de Storage (`cabe_en_almacenamiento`) y `reservar_uso_ia` (lecturas del
    mes; el tope técnico por hora/día sigue). Los límites solo frenan a personas (`auth.uid()` no nulo): scripts y
    service_role pasan. Leer límites con `private.limite_num`/`limite_bool` (un `null` jsonb no se castea).
    Plan efectivo = `households.plan`, o Familia si `prueba_hasta` está vigente (prueba una vez por hogar,
    `iniciar_prueba`). El plan solo lo cambian el cobro y la consola (trigger `proteger_plan`). Hogar suspendido = solo
    lectura: `private.tiene_rol` exige `estado = 'activo'`; el JWT trae `hogar.suspendido` para el aviso del layout.
    En TS: `src/lib/planes` (liviano, cliente) y `servidor.ts` (`cargarMiPlan` con uso; `limitesHogar`/`tieneFuncion`
    livianos para Metas y Presupuesto). `cargarPlan` de `src/lib/presupuesto` es otra cosa (plan de gastos).
    Consola: Hogares (lista por cursor, filtros, CSV con permiso exportar), Detalle (uso, miembros, cobros, cambiar plan
    y suspender con permiso `cobros`, notas internas en `hogar_notas`), Usuarios (correo enmascarado; verlo, cerrar
    sesiones y restablecer 2FA quedan auditados; permiso nuevo `usuarios`, Superadmin y Soporte) y Planes.
35. Cobros (SaaS S3; migración `cobros`). **Web Checkout de Wompi por periodo**, sin guardar datos de pago:
    `crear_cobro` (admin, cotiza con cupón y anula pendientes) → la acción redirige al checkout con firma de integridad
    → Wompi vuelve a `/ajustes/plan?id=` (solo se muestra el estado) → **solo el webhook** `/api/pagos/wompi` (checksum
    con WOMPI_EVENTS_SECRET, `registrar_pago_wompi` service_role, idempotente por `transacción:estado`, monto exacto en
    centavos) da por pagado y extiende `suscripciones` (si paga en mora conserva el ciclo). `/api/cobros` (Vercel Cron
    7:15 Bogotá) llama `procesar_vencimientos`: renovación 3 días antes (cobro con `periodo_vence`, único), mora días
    1/3/7 con correo, día 14 a Gratis; pidió no renovar → Gratis al vencer; prueba que termina en 2 días. Los correos no
    se repiten (`avisos_enviados`). Cupones: porcentaje por N cobros (null = siempre) o meses gratis (solo el alta);
    uno por hogar; si el cobro queda en $0 se activa sin Wompi. Reembolso: el dinero se devuelve en el panel de Wompi y
    la consola lo registra (permiso `cobros`). Factura electrónica: `cobros.factura_estado` queda `pendiente` hasta
    elegir proveedor. Débito automático (tarjeta tokenizada) queda para después. Sin las 3 variables WOMPI_* la app no
    ofrece pagar. En local: llaves de prueba inventadas en `.env.local` + `AVISOS_SIMULAR_FECHA=1` para `?hoy=`.

36. Integraciones (consola → Integraciones, permiso `sistema`; migración `integraciones`). Resend, Wompi, WhatsApp
    (Meta Cloud API), Anthropic y OpenAI se conectan sin código: `integraciones` guarda valores no secretos y, por
    secreto, el id en **Supabase Vault** y sus últimos 4 caracteres; solo `integracion_leer` (service_role) descifra.
    Campos permitidos en `private.campos_integracion` (= `src/lib/integraciones/catalogo.ts`). `leerIntegracion` lee la
    consola y, si no hay, las variables de entorno de antes (caché 60 s por instancia; `olvidar()` al guardar).
    «Conectar» guarda y prueba contra la API real (`probar`); correo y WhatsApp tienen envío de prueba. Webhooks:
    `/api/pagos/wompi` y `/api/whatsapp` (GET verifica `verify_token`; POST exige `X-Hub-Signature-256` con el secreto
    de la app; hoy solo registra `ultimo_evento`). La IA recibe la llave por petición (`llave` en
    `PeticionEstructurada`, un cliente por llave); nunca pasar `entornoIa()` a un componente de cliente.
    La conexión «de un clic» de WhatsApp (Embedded Signup) exige ser proveedor tecnológico aprobado por Meta.
37. Seguridad: ver `docs/SEGURIDAD.md`. `revision_seguridad()` (service_role) lista configuración insegura (tablas sin
    RLS, vistas sin `security_invoker`, funciones para anon fuera de la lista, definer sin `search_path`, funciones de
    servidor expuestas, tablas sensibles con permisos, buckets públicos); `tests/rls/seguridad.test.ts` exige cero.
    Una función nueva que solo debe usar el servidor va en esa lista; una tabla sensible nueva, también.

38. Métricas y comunicaciones (SaaS S4; migración `metricas`). `households.canal`/`referido_por` se fijan al crear el
    hogar (el proxy guarda `utm_source` y `ref` en cookies `mh_canal`/`mh_ref`; el onboarding las pasa a `crear_hogar`).
    `eventos` (registro, pagos_fijos_cargados, primer_gasto, invito_pareja una vez por hogar; pago y cancelacion
    repetibles) los escriben triggers; nadie los lee por la API. Panel general y Analítica salen de
    `consola_metricas()`/`consola_analitica()` (gráficas CSS en `graficas.tsx`, sin librerías). «Cobrado por mes» es
    caja, no MRR histórico. `correos_enviados`: `enviarCorreo` registra cada envío (destinatario enmascarado) y el
    webhook de Resend (`/api/correos/webhook`, firma Svix verificada en `src/lib/correo/eventos.ts`, secreto
    `webhook_secret` de la integración resend) sube el estado (entregado→abierto→clic; rebote queda). Campañas
    (`campanas`, permiso `campanas`): segmentos fijos (todos/gratis/familia/prueba/mora/inactivos) ∩ hogares con
    `config.correo.novedades` (opt-in, toggle en Recordatorios); las envía el cron `/api/cobros` (reclama con
    update condicional; `campana_hogares` es service_role); «Enviarme una prueba» va solo al staff. CAC: pendiente.
39. Contadores (SaaS S5; migración `contadores`). `hogar_activo` + `elegir_hogar` + `mis_hogares_lista`; el hook y
    `obtenerContexto` usan `private.hogar_activo_de` (el fallback TS sigue tomando el primero: solo tokens viejos).
    `/clientes` (enlace «Clientes» solo para contadores, vía `NavegacionConDatos`): cartera (`mis_clientes`),
    semáforo DIAN por cliente (reusa `cargarSemaforo` con el hogar del cliente; RLS lo permite por ser miembro) solo
    con firma (hogar propio admin + plan efectivo contador, `mi_firma`), enlace de referidos
    (`/registro?ref=CODIGO`, `obtener_ref` genera `households.ref_codigo` una vez) y comisiones propias. Límite de
    clientes: `aceptar_invitacion` lo exige solo si hay firma (sin plan no hay tope ni panel). Consola → Contadores:
    verificar firma (`contador_verificado`), `consola_liquidar_comisiones(mes)` (% del plan sobre cobros pagados de
    referidos, mes cerrado, upsert solo pendientes) y marcar pagada (la transferencia se hace por fuera). El plan
    Contador se compra en Configuración → Plan (ahora lista también planes `para = contador`).

40. Revisión general (2026-11-10). Hallazgos corregidos: el cron de campañas no terminaba si no había campaña (una
    función SQL que devuelve un registro compuesto responde un objeto con todo en `null`, no `null`: chequear `id`;
    tumbaba el servidor); campañas grandes se envían por tandas con cursor (`campana_reclamar`/`campana_avance`,
    migración `campanas_reanudar`); métricas y el evento «primer gasto» ignoran lo que genera el cron de pagos fijos
    (`private.mov_activo`: origen ≠ `recurrente`); el rol contador no ocupa cupo de personas del plan del cliente;
    `eliminarCuenta` validaba mal el id de un filtro `or()`; `cerrarSesion` vacía la caché del navegador
    (`revalidatePath("/", "layout")`); la lista de hogares del layout se pide una vez por request (`misHogares`, `cache`);
    el semáforo de clientes lee `tax_params` una vez por país; `/api/avisos` usa `cronAutorizado` y
    `crearClienteServicio` compartidos; tres campos sin nombre accesible; el formulario de campañas conserva lo escrito
    tras guardar. `adaptadores.test.ts` con 30 s por prueba (fallaba intermitente bajo carga en el HDD).
    Constantes compartidas entre un componente de servidor y uno `"use client"` van en un módulo aparte
    (`comunicaciones/segmentos.ts`): importadas desde el archivo de cliente llegan como referencias, no valores.
41. Contenido y parámetros (SaaS S6; migración `contenido`). **Parámetros DIAN**: `tax_params` con `publicado` +
    `borrador` (jsonb): guardar crea/actualiza el borrador y solo `consola_publicar_parametros` lo aplica (los hogares
    leen solo publicados; las consultas TS filtran `publicado` porque el cron usa service_role). `calendario_tributario`
    (pais, año gravable, dígitos 0–99, fecha; se pega como lo publica la DIAN, `src/lib/consola/calendario.ts`) +
    `members.nit_digitos` (solo los 2 últimos, `guardar_digitos_cedula`: la persona o el admin) → fecha en Renta DIAN y
    correo 60/30/7 días antes a quien alcanzó un tope el año gravable (`/api/avisos`, clave `plazo:año:miembro:días`).
    **Catálogos**: `categorias_base` (sin políticas; `sembrar_categorias` la lee, cae a CO si el país no tiene),
    `reglas_comercio_globales` (por nombre de categoría; `decidir` las usa solo si ninguna del hogar aplica; «aprendidas»
    = patrón en ≥ 3 hogares) y `formatos_extracto` (`formatoPara` en el importador, después del mapeo guardado de la
    cuenta). **IA**: `plataforma_config` `ia_umbral` (reemplaza `CONFIANZA_MINIMA` en la decisión), `ia_tope_usd_mes`
    (`reservar_uso_ia` frena todo al pasarlo) e `ia_precios` (prefijo de modelo → US$/M tokens; vacío hasta que el equipo
    los cargue). Los adaptadores reportan tokens (`alUsar`) y `registrarUsos` llama `registrar_costo_ia`, que calcula el
    costo en la base. Precisión = comprobantes registrados cuya categoría sigue siendo la que leyó la IA.
    Ojo: un jsonb `null` no se escribe con supabase-js (llega NULL de SQL): las funciones hacen `coalesce(p, 'null')`.

42. Soporte y privacidad (SaaS S7; migración `soporte_privacidad`). **Tickets**: el hogar escribe desde `/ayuda`
    (`crear_ticket`: prioridad alta si es de cobros o cuenta; máx. 5 abiertos y 10 por día); solo quien lo escribió lo
    ve (RLS). SLA de primera respuesta por prioridad (4/8/24/72 h, `private.sla_de`). Consola → Soporte (permiso
    `tickets`): respuestas guardadas (`{nombre}`), notas internas que el hogar no ve, asignar, escalar; responder avisa
    por correo. **Registro técnico** (`registrar_error`, `src/lib/registro-tecnico.ts`): errores de IA e importación
    sin montos, solo lo lee la consola en el ticket; se purga a los 90 días. **Acceso de soporte** (`accesos_soporte`):
    Soporte/superadmin pide con motivo y horas (1–72) → aviso en la app (`AvisoAccesoSoporte`, solo admin) + correo →
    el admin aprueba, rechaza o revoca → `consola_ver_finanzas` (cuentas con saldo, 100 movimientos, importaciones)
    solo con acceso vigente propio y audita cada lectura. No toca `mis_hogares()`: el equipo sigue fuera de RLS.
    **Ley 1581** (`solicitudes_privacidad`, permiso `auditoria`): plazo en días hábiles con festivos de Colombia en SQL
    (`private.festivos_co`, Emiliani y Pascua; consulta 10, reclamo 15), desde la app o registradas por correo con su
    fecha de recibo; exportación JSON (con enlaces firmados de 7 días a los soportes) o CSV; supresión: archivos de
    Storage primero (service_role), luego `consola_supresion` (hogares donde es la única persona con cuenta en cascada;
    en los compartidos se retira y el admin pasa a la persona más antigua) y la cuenta de Auth. Para retirar a alguien,
    `proteger_miembro` permite `user_id → null` solo dentro de una función de la base (`current_user = 'postgres'`).
    Retención: `purgar_retencion` (cron `/api/cobros`) borra `correos_enviados` y `registro_tecnico` de más de 90 días.
43. Sistema (SaaS S8; migración `sistema`). `funciones` (feature flags, sin políticas): encendida + planes (vacío =
    todos) + porcentaje con cubeta estable `hashtextextended(clave:hogar) % 100` (subir el % no saca a nadie) + solo
    equipo; el equipo ve encendido todo lo activo en su propio hogar. En código: `funcionActiva(clave)`
    (`src/lib/funciones.ts`, `mis_funciones` una vez por request). Mantenimiento: `MANTENIMIENTO=1` → el proxy reescribe
    a `/mantenimiento` con 503, salvo `/consola`, `/api/*` y estáticos (sin consultar la base). Consola → Sistema:
    versión (`VERCEL_GIT_COMMIT_SHA`), última migración, colas, integraciones y enlaces (`SENTRY_URL`, `ESTADO_URL`,
    `SUPABASE_PANEL_URL`).

44. Bases legales (SaaS S0; migración `consentimientos`). `/terminos` y `/privacidad` (grupo `(legal)`, públicas, sin
    base). Datos del responsable y `VERSION_LEGAL` en `src/lib/legal/responsable.ts` (con marcadores `[…]` las páginas
    muestran «Borrador»). `consentimientos` (historial, solo inserciones; trigger bloquea update): el registro con correo
    manda `consentimiento` en los metadatos de `signUp` y el trigger sobre `auth.users` lo guarda; quien entra con
    Google o sin la versión vigente marca las casillas al crear hogar o aceptar invitación (`exigirConsentimiento`,
    RPC `aceptar_consentimientos`, IP por `x-mh-ip`). Comunicaciones aceptadas → `config.correo.novedades` del hogar
    nuevo. La exportación Ley 1581 incluye los consentimientos. Falta: volver a pedir una versión nueva a quien ya
    está dentro de la app.

45. Monitoreo con Sentry (`@sentry/nextjs`, org `my-house-kr`, proyecto `my-house`). Opciones comunes en
    `src/lib/monitoreo.ts` (navegador `src/instrumentation-client.ts`, servidor/edge `src/sentry.*.config.ts`,
    `src/instrumentation.ts` con `onRequestError`); `error.tsx` y `global-error.tsx` llaman `captureException`. Sin
    `NEXT_PUBLIC_SENTRY_DSN` no envía nada. Datos financieros: sin cuerpos, cabeceras, cookies, variables locales, datos
    de consultas ni entradas/salidas de IA (`dataCollection`). Trazas 10 % en producción, 100 % en local/preview
    (`NEXT_PUBLIC_VERCEL_ENV`). La CSP agrega el origen del DSN a `connect-src`. Source maps solo con
    `SENTRY_AUTH_TOKEN` en el build. Crons de `vercel.json` vigilados (`_experimental.vercelCronsMonitoring`).

46. Página de estado: externa (Better Stack, ROADMAP §4.12); la consola la enlaza con `ESTADO_URL`. La app expone
    `/api/salud/<componente>` (`app`, `base`, `auth`, `archivos`, `correo`, `pagos`, `ia`; `src/lib/salud`): 200
    operativo, 503 falla, sin detalles (el motivo va al log). Resultado cacheado 60 s por instancia, 8 s de límite por
    chequeo. Correo sin enviar nada: una llave Resend de solo envío responde `restricted_api_key` (401) = operativa.
    IA operativa si al menos un proveedor conectado responde. `/api/salud` resume todo (503 si algo falla).

## Entorno local: problemas conocidos
- Si el disco se llena mientras Docker descarga imágenes, pueden quedar archivos de 0 bytes en las capas
  (pasó con `storage-api`: migraciones vacías y Storage arrancaba sin tablas). Síntoma: `relation "storage.buckets"
  does not exist`. Arreglo usado: reconstruir la imagen localmente con `migrations/` y `package.json` del tag
  oficial de github.com/supabase/storage, con el mismo nombre de imagen, y `supabase stop --no-backup`.
- `.env.local` se genera con `npx supabase status -o env` (API_URL, ANON_KEY, SERVICE_ROLE_KEY).
- `supabase start` puede fallar por health check (Storage tarda en arrancar; pg-meta fallaba): `db:start` excluye
  `postgres-meta` (solo lo usa Studio). Si la CLI cree que todo corre pero falta un servicio, `npx supabase stop`
  (conserva los datos) y `npm run db:start`.

## Fuera de la Fase 1 (preparado, no implementado)
OCR con IA, registro por WhatsApp, pronóstico estadístico, pagos/suscripciones, conexión bancaria.
Ganchos: enum `mov_origen`, `src/lib/ingesta`, registro de jurisdicciones, `households.plan`, tabla `budgets_goals`.

## Estado
- [x] 0. Scaffold
- [x] 1. Migraciones + RLS + prueba de aislamiento
- [x] 2. Dinero y fechas
- [x] 3. Auth, 2FA, crear hogar, invitación
- [x] 4. Layout + PWA
- [x] 5. Cuentas y categorías
- [x] 6. Movimientos + registro rápido
- [x] 7. Recurrentes
- [x] 8. Importación CSV
- [x] 9. Dashboard del mes
- [x] 10. Semáforo DIAN
- [x] 11. Cierre: CI, autoría en BD, guía de despliegue (`docs/DESPLIEGUE.md`)
- [x] 12. Diseño visual del sistema My House (navegación, Inicio, Movimientos, Pagos fijos, Renta DIAN, Configuración)
- [x] 13. Velocidad (JWT con hogar), pantallas del diseño, asistente de comprobantes e importación de PDF
- [x] 14. Contexto del hogar (personas a cargo, dependientes DIAN), OpenAI como proveedor, filtro Personal/Negocio,
  registro sin conexión, tuteo en toda la app
- [ ] Publicar en Supabase Cloud + Vercel (requiere las cuentas del usuario) — es la fase S0 del roadmap SaaS

### Fase SaaS (`docs/ROADMAP-SAAS.md`)
- [ ] S0. Despliegue y bases legales — desplegado; términos, política y consentimientos hechos (faltan los datos del responsable)
- [x] S1. Consola: acceso con 2FA, equipo y permisos, auditoría (verificado en local el 2026-11-09)
- [x] S2. Planes y límites, Hogares, Usuarios, Planes (verificado en local el 2026-11-10)
- [x] S3. Cobro con Wompi, cupones, recuperación de pagos fallidos (factura electrónica: falta el proveedor)
- [x] S4. Métricas (panel, analítica) y comunicaciones (campañas por correo) — CAC y canal WhatsApp pendientes
- [x] S5. Contadores: selector de hogares, panel con semáforo por cliente, referidos y comisiones — descarga masiva y recordatorios masivos pendientes
- [x] S6. Parámetros DIAN (borrador/publicar, calendario por cédula), catálogos (categorías base, reglas globales, formatos de extracto) e IA (umbral, tope de gasto, costo y precisión)
- [x] S7. Soporte (tickets, registro técnico), acceso a finanzas con permiso del hogar y Ley 1581 (plazos hábiles, exportación, supresión)
- [x] S8. Sistema: feature flags por plan/porcentaje/equipo, mantenimiento, versión y colas — Integraciones ya está hecha (decisión 36)

### Criterios de terminado de la Fase 1 (verificados el 2026-11-04 en local)
- Dos usuarios del mismo hogar ven los mismos movimientos y otro hogar no ve nada: `tests/rls` + prueba en
  navegador (Ana admin, Beto invitado como editor).
- Extracto de 3 meses sin duplicados: `docs/ejemplos` (39 filas) + extracto solapado (13 ya importados, 2 nuevos);
  pruebas en `src/lib/importacion`.
- Tablero con costo de vida del mes y semáforo DIAN del año en curso.
- PWA: manifest + service worker verificados en build de producción; registro rápido en 3 toques. Instalar en
  el celular requiere HTTPS (después del despliegue).
