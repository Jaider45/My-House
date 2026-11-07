@AGENTS.md

# My House — finanzas familiares

WebApp (PWA) para que un hogar registre ingresos y gastos, conozca su costo de vida, y llegue a la
declaración de renta con todo ordenado. MVP para una familia; arquitectura multi-tenant (SaaS) desde el día uno.

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
11. Número mínimo = fijos del mes (confirmados + programados) + variables esenciales (promedio de los últimos 3
    meses cerrados que tengan gastos categorizados; si no hay, mes actual) + cuota de imprevistos (% sobre esa
    suma). Costo de vida = gastos confirmados + programados del mes, sin categorías `excluir_de_costo_vida`; lo sin
    categoría cuenta como variable no esencial. Costo por persona divide entre todos los miembros (con
    dependientes). Cálculo puro en `src/lib/finanzas`.
12. Next 16 con `cacheComponents` activo (será obligatorio en la próxima versión mayor).
13. `@types/node@24` (coincide con Node 24 y lo exige Vitest 5).
14. Un usuario opera un hogar (el primero al que pertenece). El selector de hogares queda para el SaaS.
15. Velocidad: el JWT trae el hogar, el miembro y el rol (`public.custom_access_token_hook`, activado en
    `config.toml` y en el panel de Supabase Cloud). `obtenerContexto()` los lee con `getClaims()` (verificación local
    con la llave pública, sin red) y solo consulta la base si el token no los trae. Tras crear hogar, aceptar
    invitación o editar hogar/rol propio se llama `auth.refreshSession()`. Vercel en `gru1`, junto a Supabase.
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
22. Módulos (migración `modulos`): presupuesto = pagos fijos de la categoría + adicional (`budgets_goals` tipo
    `presupuesto`); pronóstico de cierre = max(real + programado, fijos) + ritmo del gasto variable
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
    **Supabase** envía los de acceso: `supabase/templates/*.html` se GENERAN desde `src/lib/correo/supabase.ts` con
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
    Falta: el reporte para el contador (solo diseño) y WhatsApp/notificaciones.

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
- [ ] Publicar en Supabase Cloud + Vercel (requiere las cuentas del usuario)

### Criterios de terminado de la Fase 1 (verificados el 2026-11-04 en local)
- Dos usuarios del mismo hogar ven los mismos movimientos y otro hogar no ve nada: `tests/rls` + prueba en
  navegador (Ana admin, Beto invitado como editor).
- Extracto de 3 meses sin duplicados: `docs/ejemplos` (39 filas) + extracto solapado (13 ya importados, 2 nuevos);
  pruebas en `src/lib/importacion`.
- Tablero con costo de vida del mes y semáforo DIAN del año en curso.
- PWA: manifest + service worker verificados en build de producción; registro rápido en 3 toques. Instalar en
  el celular requiere HTTPS (después del despliegue).
