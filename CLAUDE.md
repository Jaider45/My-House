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
  `src/lib/ingesta` punto único para crear movimientos (manual, CSV, recurrente; luego OCR/WhatsApp/banco).
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
4. Invitación por enlace copiable (sin servidor de correo en Fase 1).
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
11. Número mínimo = fijos del mes (confirmados + programados) + variables esenciales (promedio últimos 3 meses
    cerrados; si no hay historia, mes actual) + cuota de imprevistos (% sobre esa suma).
12. Next 16 con `cacheComponents` activo (será obligatorio en la próxima versión mayor).
13. `@types/node@24` (coincide con Node 24 y lo exige Vitest 5).
14. Un usuario opera un hogar (el primero al que pertenece). El selector de hogares queda para el SaaS.
15. `crearClienteServidor()` llama `await connection()`: todo lo que toca Supabase se renderiza por request
    (supabase-js usa `Date.now()` y Cache Components lo rechaza en prerender).
16. Sesión y 2FA se chequean en `src/proxy.ts` (optimista); la autorización real es RLS.
    `obtenerContexto()` (`src/lib/sesion.ts`) es la capa de acceso: usuario + miembro + hogar por request.
17. PWA sin librerías: `src/app/manifest.ts` + `public/sw.js` escrito a mano. El SW no guarda páginas ni datos
    (información financiera); solo estáticos con hash y la página `/sin-conexion`. Solo se registra en producción.
    Íconos: `node scripts/generar-iconos.mjs` (usa `sharp`, que ya trae Next).
18. Cuentas y categorías con movimientos no se borran: se archivan (borrar una cuenta borraría su historia en
    cascada). En tarjetas, el "saldo inicial" se captura como deuda y se guarda negativo.
19. Importación CSV: se parsea en el navegador (UTF-8, o Windows-1252 si hay caracteres dañados), se detecta
    el encabezado y se recuerda el mapeo por cuenta. Huella = sha256(cuenta|fecha|tipo|monto|descripción
    normalizada|n-ésima repetición en el archivo), recalculada en el servidor. "Posible duplicado" = movimiento
    no importado de igual tipo y monto a ±2 días (se presenta desmarcado). Lo importado puede quedar sin
    categoría; se sugiere la de comercios ya categorizados. Deshacer = borrar el lote (cascada).
    Extractos de ejemplo: `node scripts/generar-extractos.mjs` → `docs/ejemplos/`.

## Entorno local: problemas conocidos
- Si el disco se llena mientras Docker descarga imágenes, pueden quedar archivos de 0 bytes en las capas
  (pasó con `storage-api`: migraciones vacías y Storage arrancaba sin tablas). Síntoma: `relation "storage.buckets"
  does not exist`. Arreglo usado: reconstruir la imagen localmente con `migrations/` y `package.json` del tag
  oficial de github.com/supabase/storage, con el mismo nombre de imagen, y `supabase stop --no-backup`.
- `.env.local` se genera con `npx supabase status -o env` (API_URL, ANON_KEY, SERVICE_ROLE_KEY).

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
- [ ] 9. Dashboard del mes
- [ ] 10. Semáforo DIAN
- [ ] 11. Cierre y despliegue
