# Mejoras pendientes de My House

Revisión del 2026-11-08 contra las buenas prácticas de Next.js (skill `nextjs-best-practices` + documentación
de Next 16.4.5 en `node_modules/next/dist/docs/`, en especial `02-guides/production-checklist.md`).

Cada mejora dice **qué** hacer, **por qué** importa y **qué pasa si no se hace** (vulnerabilidad o falencia).
Prioridad: 🔴 alta (seguridad o datos) · 🟠 media (confiabilidad o costo) · 🟢 baja (rendimiento o pulido).

| # | Mejora | Prioridad | Esfuerzo |
| --- | --- | --- | --- |
| 1 | ~~Acciones de servidor que fallan en silencio~~ ✅ hecho (2026-11-09) | 🔴 | Bajo |
| 2 | ~~`guardarPresupuesto`: validar datos y revisar errores~~ ✅ hecho (2026-11-09) | 🔴 | Bajo |
| 3 | ~~Límite de uso en las acciones de IA~~ ✅ hecho (2026-11-09) | 🔴 | Medio |
| 4 | Content Security Policy para toda la app — ✅ en Report-Only (2026-11-09); falta activarla (`CSP_MODO=activa`) | 🟠 | Medio |
| 5 | ~~`app/global-error.tsx`~~ ✅ hecho (2026-11-09) | 🟠 | Bajo |
| 6 | ~~Impedir que los buscadores indexen la app~~ ✅ hecho (2026-11-09) | 🟠 | Bajo |
| 7 | ~~`/api/avisos`: tiempo límite y escala~~ ✅ hecho (2026-11-09) | 🟠 | Medio |
| 8 | ~~`/api/avisos`: comparar el secreto en tiempo constante~~ ✅ hecho (2026-11-09) | 🟢 | Bajo |
| 9 | ~~Cargar `papaparse` solo cuando se necesita~~ ✅ hecho (2026-11-09) | 🟢 | Bajo |
| 10 | ~~Registrar la skill donde Claude Code la encuentra~~ ✅ hecho (2026-11-08) | 🟢 | Bajo |
| 11 | ~~`zod` en el navegador por dos constantes~~ ✅ hecho (2026-11-09) | 🟠 | Bajo |
| 12 | ~~supabase-js en el navegador solo para la verificación en dos pasos~~ ✅ hecho (2026-11-09) | 🟠 | Medio |
| 13 | ~~Movimientos: catálogos y movimientos en serie~~ ✅ hecho (2026-11-09) | 🟢 | Bajo |
| 14 | ~~Editar movimiento: movimiento y catálogos en serie~~ ✅ hecho (2026-11-09) | 🟢 | Bajo |
| 15 | Trazos de íconos y logo con menos precisión (SVGO) — pendiente | 🟢 | Medio |

## Estado de la aplicación (2026-11-09)

Aplicadas en la rama `docs/mejoras-nextjs`. Verificado con `npm run check` (lint, typecheck, 191 pruebas unitarias),
`npm run test:rls` (41 pruebas, 9 nuevas en `tests/rls/mejoras.test.ts`) y un build de producción probado con curl:

- **1.** Las 15 acciones devuelven `Estado`; `FormularioAccion` muestra el error junto al botón. Probado: una editora
  que invoca `cambiarRol` recibe «Solo un administrador…» y el rol no cambia; un id inexistente responde
  «No encontramos ese registro…» en vez de nada.
- **2.** Migración `20261109000100_presupuesto_y_cupo_ia.sql` → `guardar_presupuesto` (una llamada, todo o nada). Probado:
  guarda y redirige a `?mes=`; `mes=2026-11&x=1` o un id que no es UUID se rechazan sin tocar la base; una
  categoría de otro hogar revierte también las válidas.
- **3.** `reservar_uso_ia`: 30 lecturas por persona y hora, 150 por hogar y día. El bonus (reutilizar la respuesta si
  se sube el mismo archivo) **no** se hizo.
- **4.** CSP en `next.config.ts` como `Content-Security-Policy-Report-Only`. Pendiente: usar la app unos días en
  producción y poner `CSP_MODO=activa` si la consola no muestra bloqueos.
- **5–6.** `global-error.tsx`, `robots.ts` y `noindex` en la metadata (`robots.txt` además se excluyó del proxy, que lo
  redirigía a `/ingresar`).
- **7–8.** `/api/avisos` por páginas con cursor, reserva de claves en una consulta, envío a ritmo del proveedor,
  `correos_de_usuarios` en vez de `listUsers`, `maxDuration = 300`, encadenado con `after()` y `timingSafeEqual`.
  Migración `20261109000200_avisos_escala.sql`. Probado: 401 sin secreto o con uno malo; con páginas de 1 hogar,
  la vuelta 2 arranca sola y la segunda corrida del día no repite correos.
- **9.** `papaparse` quedó en un chunk aparte (18,7 KB) que `/importar` pide al acercarse al selector.

## Impacto en la velocidad

Ninguna mejora, hecha como está descrita, hace más lenta la app. Dos la hacen más rápida.

| # | Efecto en la velocidad |
| --- | --- |
| 1 | Ninguno: devolver un mensaje en vez de `return;` no agrega consultas. |
| 2 | **Más rápida.** Hoy guarda con una consulta por categoría, una tras otra; en una sola llamada (función RPC) son menos idas y vueltas a la base. zod tarda microsegundos. |
| 3 | Casi nada: una consulta corta (~5–20 ms en `gru1`) **solo** en las acciones de IA, que ya tardan varios segundos esperando al modelo. Las demás pantallas no la pagan. |
| 4 | Ninguno, **siempre que sea sin `nonce`** (ver la nota de la mejora 4). Con `nonce` sí sería más lenta. |
| 5 | Ninguno: `global-error.tsx` solo se usa cuando hay un error. |
| 6 | Ninguno: `robots` es metadata; un archivo más que solo leen los buscadores. |
| 7 | Ninguno para la persona: es el cron de las 7:00 a. m. |
| 8 | Ninguno: comparar el secreto cuesta microsegundos. |
| 9 | **Más rápida.** `/importar` descarga ~20 KB menos de JavaScript al abrirse. |

## Cómo aplicarlas para que la app sea más rápida

### Reglas generales (valen para todas)

1. **Cada ida a la base cuesta ~5–20 ms aunque Vercel y Supabase estén en `gru1`.** Lo que más frena es encadenar
   consultas una tras otra. Antes de agregar una consulta, ver si se puede meter en otra que ya existe o en una
   función SQL (RPC) que haga todo en una sola llamada.
2. **Las consultas independientes van en paralelo** con `Promise.all`, nunca con `await` una por una.
3. **Revisar el permiso antes de tocar la base.** `obtenerContexto()` lee el rol del JWT sin red (decisión 15):
   comprobar `puedeEditar`/`esAdmin` y validar con zod *antes* de cualquier consulta. Rechazar no debe costar nada.
4. **Nada de `nonce`, ni de leer `headers()`/`cookies()` en el layout raíz.** Rompería el prerender parcial
   (`cacheComponents` + `partialPrefetching`) que hace instantánea la navegación.
5. **No agregar `<Suspense>` ni `loading.tsx` por página** (decisión 15): eso alarga la espera ≥ 300 ms.
6. **Medir antes y después en build de producción** (`npm run build && npm start`), no en `next dev` sobre el disco G:
   (5–10× más lento). En el navegador: pestaña *Network* del cambio de pantalla y el peso de JS por ruta.

### Mejora por mejora

**1. Acciones que fallan en silencio**
- Devolver el mensaje **antes** de cualquier consulta (`if (!ctx.puedeEditar) return { error: … }`): no hay costo.
- Para saber si RLS bloqueó una escritura no hacer un `select` aparte: agregar `.select("id")` a la misma
  `update`/`delete` y mirar si volvió vacío. Una sola ida a la base.
- Las acciones que hoy se usan como `action={...}` sin estado pasan a `useActionState`; el botón ya muestra el
  pendiente con `BotonEnviar`, así que la sensación de rapidez no cambia.

**2. `guardarPresupuesto`**
- Hoy hace 1 `delete` + hasta 2 consultas **por cada categoría**, en serie: con 15 categorías son ~30 idas a la
  base (~300 ms o más). Reemplazarlo por **una función SQL** `guardar_presupuesto(p_items jsonb)` que en una
  transacción borre los montos en 0 e inserte o actualice el resto con
  `insert … on conflict (household_id, category_id) where tipo = 'presupuesto' do update`. Queda en **una** llamada
  y es todo o nada.
- Ojo: el `upsert()` de supabase-js no sirve aquí, porque el índice único `budgets_goals_presupuesto_uidx` es
  parcial (`where tipo = 'presupuesto'`) y PostgREST no puede apuntarle. Por eso la función SQL.
- La función debe ser `security invoker` (que corra RLS como la persona) y revisar `private.tiene_rol` como las
  demás. Validar con zod en la acción (UUID, entero ≥ 0, `mes` con `/^\d{4}-\d{2}$/`) antes de llamarla.
- Mandar solo las categorías que **cambiaron**: el formulario puede comparar con el valor inicial y omitir el resto.

**3. Límite de uso en la IA**
- No usar un servicio externo (Redis, Upstash): sería otra red más en cada lectura. Contar en Postgres, en la misma
  región.
- Una función SQL `reservar_uso_ia(p_tipo)` que en **una sola llamada** cuente lo usado en la última hora y día y,
  si hay cupo, inserte el registro. Índice en `(household_id, creado_en desc)` para que el conteo sea instantáneo.
- Llamarla en paralelo con la preparación del archivo (`Promise.all` con la lectura del `FormData` y el
  base64), no antes, para que sus ~10 ms se escondan detrás de trabajo que igual hay que hacer.
- Solo en `enviarAlAsistente` (`comprobantes/acciones.ts`) y `leerExtractoPdf` (`importar/acciones.ts`). Ninguna
  otra pantalla la paga.
- Bonus de velocidad: si la persona sube el mismo archivo dos veces, se puede guardar la huella (sha256) del
  archivo y reutilizar la respuesta anterior en vez de volver a llamar al modelo: ahorra varios segundos y dinero.

**4. Content Security Policy**
- Como encabezado fijo en `headers()` de `next.config.ts`, junto a los que ya existen. Next lo pone sin calcular nada
  por request.
- Sin `nonce` (rompe el prerender) y sin generarla en `src/proxy.ts` (el proxy corre en cada request).
- `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com` (+ Google si está activo),
  `connect-src 'self' <URL de Supabase>`, `frame-src https://challenges.cloudflare.com`, `img-src 'self' data: blob:`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- Primero como `Content-Security-Policy-Report-Only` unos días; luego activarla.
- Si un día se quiere quitar `'unsafe-inline'`: probar la CSP con hashes (SRI, experimental en Next), que sí
  respeta el prerender. Nunca pasar a `nonce`.

**5. `global-error.tsx`**
- Componente de cliente **sin importar** `PaginaEstado` ni `marca.tsx` (los íconos son pesados): HTML simple con los
  estilos de `globals.css`. Así no suma nada al JavaScript que se descarga normalmente.

**6. Robots**
- `src/app/robots.ts` sin leer nada dinámico: Next lo genera una vez en el build y lo sirve como archivo estático.
- `robots: { index: false, follow: false }` en el objeto `metadata` del layout raíz: es estático, no usa
  `generateMetadata`.

**7. `/api/avisos`**
- No afecta a la persona, pero sí el costo de Vercel. Hoy, por cada hogar, hace las consultas de `avisos_enviados` y
  los envíos uno por uno. Para escalar:
  - Leer `avisos_enviados` de **todos** los hogares en una sola consulta al principio (por fecha), no una por hogar.
  - Reservar todas las claves de una vez (`insert` de varias filas) y enviar los correos en paralelo por tandas
    (p. ej. de a 10 con `Promise.all`), respetando el límite de Resend.
  - Leer de Auth solo los usuarios que son admin/editor (los `user_id` que ya trae la consulta de `members`), no
    toda la lista.
  - Exportar `maxDuration` y, cuando haya muchos hogares, partir por tandas (`?desde=` o una cola).

**8. Secreto en tiempo constante**
- `crypto.timingSafeEqual` sobre dos `Buffer` de igual largo. Microsegundos.

**9. `papaparse` bajo demanda**
- Se usa en dos sitios de `importador.tsx`: `Papa.parse` (línea 30) y `Papa.unparse` (línea 73). Cambiar ambos a
  `const { default: Papa } = await import("papaparse")` dentro de la función.
- Para que no haya espera al elegir el archivo: precargarlo cuando la persona **abre** el selector o pasa el mouse por
  el botón (`onPointerEnter`/`onFocus` → `import("papaparse")`). El navegador lo deja en caché y al leer ya está.

### Orden recomendado

1. **Mejora 2** primero: es la que más acelera (de ~30 consultas a 1) y cierra un riesgo de datos.
2. **Mejora 9**: rápida de hacer y se nota en `/importar`.
3. **Mejoras 1, 5, 6 y 8**: cambios pequeños que no tocan la velocidad.
4. **Mejora 3** (necesita una migración) y **4** (necesita probar en `Report-Only`).
5. **Mejora 7** cuando haya más hogares.

Después de cada una: `npm run check`, `npm run test:rls` si cambió SQL, y comparar en build de producción el
tiempo de la pantalla afectada.

---

## 1. 🔴 Acciones de servidor que fallan en silencio

**Qué.** En 15 lugares una acción sale con `return;`, sin mensaje, cuando la persona no tiene permiso:

- `src/app/(app)/ajustes/acciones.ts:51, 97, 105`
- `src/app/(app)/categorias/acciones.ts:45`
- `src/app/(app)/comprobantes/acciones.ts:261, 271`
- `src/app/(app)/cuentas/acciones.ts:69`
- `src/app/(app)/importar/acciones.ts:149`
- `src/app/(app)/movimientos/acciones.ts:80, 93`
- `src/app/(app)/presupuesto/acciones.ts:11`
- `src/app/(app)/recordatorios/acciones.ts:39, 50`
- `src/app/(app)/recurrentes/acciones.ts:62, 72`

Hay que devolver un `Estado` con error (`{ error: "Tu rol es de solo lectura." }`) y mostrarlo en el formulario,
como ya hacen `guardarMovimiento` y `registrarRapido`.

**Por qué importa.** La regla 28 de `CLAUDE.md` lo exige: RLS sin permiso actualiza 0 filas **sin error**, así que
la interfaz no se entera de que nada se guardó. Además, cada acción exportada es un endpoint público que cualquiera
puede invocar con un POST; su respuesta debe ser explícita.

**Si no se hace.**
- Un contador (solo lectura) o un editor que intenta algo de admin pulsa «Eliminar» o «Guardar», no ve nada y cree
  que funcionó. En una app de finanzas eso es un dato falso: la persona cree que borró un movimiento duplicado o
  archivó una cuenta, y no fue así.
- Los errores de Supabase en esas mismas acciones (red, restricciones) tampoco llegan a la persona.
- Hoy no es una fuga de datos (RLS bloquea), pero sí una falencia de integridad y de confianza.

---

## 2. 🔴 `guardarPresupuesto`: validar datos y revisar errores

**Qué.** En `src/app/(app)/presupuesto/acciones.ts`:

1. Validar con zod cada `category_id` (sale del nombre del campo `adicional:<id>`) como UUID, y el monto como entero ≥ 0.
2. Revisar el `error` de cada `delete`, `update` e `insert`; si alguno falla, devolver un mensaje en lugar de redirigir.
3. Validar `mes` con `/^\d{4}-\d{2}$/` antes de ponerlo en `redirect()` (línea 27).
4. Idealmente, hacer todo en una sola llamada (una función RPC; ver «Cómo aplicarlas») para que quede todo o nada.

**Por qué importa.** Es la única acción que escribe sin esquema zod. Next recomienda validar **todo** lo que llega a
una acción, porque el `FormData` lo arma el cliente y se puede alterar.

**Si no se hace.**
- **Datos corruptos:** un `category_id` arbitrario llega a la consulta. RLS y la FK compuesta impiden tocar otro
  hogar, pero un valor inválido produce un error que hoy se ignora.
- **Guardado parcial sin aviso:** si falla el tercer `insert` de diez, los dos primeros quedan guardados, el resto
  no, y la persona ve «guardado». El presupuesto alimenta el costo de vida y el número mínimo (decisión 11): esas
  cifras saldrían mal sin que nadie lo note.
- **Parámetro sin validar en la URL:** `mes` entra tal cual en la redirección. No es una redirección a otro sitio
  (la ruta empieza por `/presupuesto`), pero permite inyectar parámetros extra (`2026-11&x=...`) y es un patrón que
  se copia a otras acciones.

---

## 3. 🔴 Límite de uso en las acciones de IA

**Qué.** Las acciones de `src/app/(app)/comprobantes/acciones.ts` (y la lectura de PDF del importador) llaman a
Anthropic u OpenAI sin límite. Agregar una cuota por hogar y por usuario (p. ej. N lecturas por hora y M por día),
guardada en una tabla con RLS o contada sobre los adjuntos ya procesados, y devolver un mensaje claro al alcanzarla.

**Por qué importa.** La lista de producción de Next pide *rate limiting* para operaciones caras. Cada llamada cuesta
dinero real y tiempo de función en Vercel. La llave es del dueño de la app, no de cada hogar.

**Si no se hace.**
- **Abuso de costo (denial of wallet):** una sesión robada, un script o un error en el cliente que reenvía en bucle
  puede hacer miles de llamadas y gastar el saldo de la API en horas.
- **Agotar la cuota del proveedor:** al llegar al límite de la cuenta, el asistente deja de funcionar para **todos**
  los hogares.
- En el modelo SaaS esto es crítico: sin cuota no hay forma de cobrar planes ni de contener a un hogar abusivo.

---

## 4. 🟠 Content Security Policy para toda la app

**Qué.** Hoy la CSP solo cubre `/sw.js`. Definirla para todas las rutas **en `next.config.ts` (`headers()`), sin
`nonce`** (sección «Without Nonces» de `01-app/02-guides/content-security-policy.md`). Orígenes que hay que permitir:
Supabase (`connect-src`), Cloudflare Turnstile (`script-src`, `frame-src`), Google (si `NEXT_PUBLIC_GOOGLE_ACTIVO=1`)
e imágenes `data:` (el QR del 2FA). Más adelante, si se quiere quitar `'unsafe-inline'` de `script-src`, probar la
CSP con hashes (Subresource Integrity, experimental en Next), que sí respeta el prerender.

**Por qué importa.** La CSP es la segunda barrera contra XSS: aunque se cuele un script, el navegador no lo ejecuta
si no viene de un origen permitido. Ya hay `X-Frame-Options: DENY`, pero eso solo cubre el clickjacking.

**Si no se hace.**
- Un XSS (por una dependencia comprometida, por un `dangerouslySetInnerHTML` futuro, por texto de la IA mal
  escapado) puede leer los saldos y movimientos que hay en pantalla, enviar acciones de servidor en nombre de la
  persona o mandar los datos a un servidor externo. Con la sesión en cookies, el script actúa como la persona.
- En una app con información financiera y tributaria, es la diferencia entre un error contenido y una filtración.

**Ojo: no usar `nonce`.** La guía de Next lo dice: con `nonce` cada página se genera entera por request y el
prerender parcial queda deshabilitado. Esta app usa `cacheComponents` + `partialPrefetching`, que arman de antemano
la parte estática de cada pantalla; con `nonce` la navegación sería más lenta. Una CSP estática en `next.config.ts` es
un encabezado más en la respuesta: no cuesta nada en velocidad. Empezar con `Content-Security-Policy-Report-Only` para
ver qué se rompe antes de activarla.

---

## 5. 🟠 `app/global-error.tsx`

**Qué.** Crear `src/app/global-error.tsx` (componente de cliente, con su propio `<html lang="es-CO">` y `<body>`),
con el mismo diseño de `error.tsx` y el botón `retry`.

**Por qué importa.** `error.tsx` no atrapa los errores del layout raíz (`src/app/layout.tsx`), porque está dentro de
él. La documentación de Next 16.4 lo incluye en su lista de producción.

**Si no se hace.**
- Si falla el layout raíz (la fuente, el registro del SW, un cambio futuro), la persona ve la pantalla genérica de
  Next, en inglés y sin marca, y sin forma clara de volver.
- Se pierde el código de referencia (`digest`) que hoy muestra `error.tsx` para rastrear el fallo.

---

## 6. 🟠 Impedir que los buscadores indexen la app

**Qué.** Crear `src/app/robots.ts` con `disallow: "/"` y agregar `robots: { index: false, follow: false }` a la
metadata de `src/app/layout.tsx`. Si más adelante hay una página pública de marketing, se habilita solo esa.

**Por qué importa.** Es una herramienta privada. Las rutas públicas (`/ingresar`, `/registro`, `/recuperar`,
`/invitacion/[token]`) no deben salir en buscadores.

**Si no se hace.**
- **Enlaces de invitación en Google:** si un enlace `/invitacion/<token>` se comparte en un sitio público o queda en
  un historial sincronizado, un buscador lo puede rastrear. El token vence, pero mientras esté vigente cualquiera
  que lo encuentre puede unirse al hogar y ver todas sus finanzas.
- Las pantallas de acceso indexadas atraen bots de fuerza bruta y facilitan el phishing con páginas que las imitan.

---

## 7. 🟠 `/api/avisos`: tiempo límite y escala

**Qué.** En `src/app/api/avisos/route.ts`:

1. Exportar `maxDuration` acorde al plan de Vercel.
2. Para el SaaS, procesar por tandas: paginar los hogares (o filtrar por un cursor) y que el cron llame varias veces,
   o encolar un trabajo por hogar.
3. Hoy se lee **toda** la lista de usuarios de Auth (`listUsers` de 1000 en 1000) en cada ejecución; leer solo los
   correos de los miembros que van a recibir algo.

**Por qué importa.** Recorre todos los hogares, recordatorios y movimientos en una sola invocación con la llave
`service_role`.

**Si no se hace.**
- Con decenas de hogares funciona; con cientos, la función supera el tiempo límite y Vercel la corta a la mitad.
  Unos hogares reciben sus recordatorios y otros no, y como la clave del aviso se reserva antes de enviar, un corte
  en el momento equivocado puede dejar avisos marcados como enviados que nunca salieron.
- Recordatorios de pagos que no llegan = multas o intereses para la familia, justo lo que la app promete evitar.

---

## 8. 🟢 `/api/avisos`: comparar el secreto en tiempo constante

**Qué.** Reemplazar `request.headers.get("authorization") !== \`Bearer ${secreto}\`` por una comparación con
`crypto.timingSafeEqual` (igualando antes las longitudes).

**Por qué importa.** Es la única puerta de una ruta que usa la llave `service_role` (que salta RLS) y envía correos a
todos los hogares.

**Si no se hace.** En teoría, midiendo cuánto tarda la respuesta se puede adivinar el secreto carácter por carácter.
En la práctica la latencia de red lo hace muy difícil, por eso la prioridad es baja; pero es un cambio de una línea en
el endpoint más privilegiado de la app.

---

## 9. 🟢 Cargar `papaparse` solo cuando se necesita

**Qué.** En `src/app/(app)/importar/importador.tsx`, reemplazar `import Papa from "papaparse"` por
`const { default: Papa } = await import("papaparse")` dentro de la función que lee el archivo.

**Por qué importa.** La skill y la documentación de Next recomiendan cargar bajo demanda las librerías pesadas de
cliente. `papaparse` solo se usa después de que la persona elige un archivo.

**Si no se hace.** Unos ~20 KB más de JavaScript (minificado; ~7 KB comprimido) que se descargan y analizan cada vez que se abre `/importar`, aunque
no se importe nada. El impacto es pequeño; se nota más en celulares de gama baja y con datos móviles.

---

## 10. ✅ Registrar la skill donde Claude Code la encuentra (hecho el 2026-11-08)

**Qué.** Mover `.agents/skills/nextjs-best-practices/SKILL.md` a `.claude/skills/nextjs-best-practices/SKILL.md`
(o borrarla si no se va a usar) y decidir si `skills-lock.json` se versiona.

**Por qué importa.** Claude Code solo lee skills de `.claude/skills/`; donde está ahora no se puede invocar.

**Si no se hace.** La skill no se usa sola y hay que aplicarla a mano. Además, es genérica: recomienda `loading.tsx`
por página y caché en `fetch`, cosas que este proyecto descartó a propósito (ver abajo). Si se registra, conviene
agregarle una nota que remita a las decisiones de `CLAUDE.md`.

---

## Rendimiento React (skill `vercel-react-best-practices`, 2026-11-09)

Revisión del proyecto con la skill de Vercel (`.agents/skills/vercel-react-best-practices`, 70 reglas). Las críticas
(cascadas de datos, tamaño del JS) casi se cumplían: las pantallas piden sus datos en paralelo con `Promise.all`,
`obtenerContexto` usa `React.cache`, `papaparse` y Turnstile se cargan solo donde se usan y las pantallas de la app
bajan 72–84 KB de JS propio (23–28 KB comprimidos). Quedaban estos cinco puntos. Tamaños medidos en el build de
producción (`.next/server/app/**/page_client-reference-manifest.js`, suma de los chunks de cada ruta).

Verificado: `npm run check` (lint, typecheck, 191 pruebas), build de producción y, con sesión real contra
`next start`: Seguridad llega con el estado de 2FA ya pintado; activar → código malo rechazado → confirmar →
verificar en `/mfa` (la sesión pasa a AAL2, cookies nuevas) → desactivar, llamando las acciones de servidor reales;
Movimientos con y sin filtro de categoría (las subcategorías se siguen sumando); detalle de un movimiento y 404 de
uno inexistente.

### 11. ✅ `zod` en el navegador por dos constantes (regla `bundle-barrel-imports`)

**Qué se hizo.** Las constantes que usan los formularios (`MAX_CONTEXTO`, `PARENTESCOS`, y también `PROVEEDORES_IA`,
`PATRON_MODELO`) pasaron a `src/lib/hogar/constantes.ts`, que no importa nada. `src/lib/hogar/index.ts` las
re-exporta, así que el código de servidor no cambió. `ajustes/hogar/formulario.tsx` y
`ajustes/miembros/formularios.tsx` importan de `@/lib/hogar/constantes`.

**Para qué.** `src/lib/hogar/index.ts` importa `zod` (valida `households.config`). Un componente de cliente que
importa cualquier cosa de ese archivo arrastra zod completo al navegador, aunque solo use una constante.
Configuración › Hogar y › Miembros pasaron de ~183 KB a 76 KB de JS (de ~55 KB a 25 KB comprimidos).

**Si no se hace (o si se vuelve a romper).** Cada persona que abre esas pantallas descarga, interpreta y ejecuta
~107 KB que no usa: más lento en celulares de gama media y con datos móviles. Regla para el futuro: un componente
`"use client"` solo importa de `src/lib` módulos sin dependencias pesadas (zod, supabase, SDK de IA). Si una
constante vive junto a código pesado, se separa como aquí.

### 12. ✅ supabase-js en el navegador solo para la verificación en dos pasos (regla `bundle-conditional`)

**Qué se hizo.** Las operaciones de 2FA se hacen en el servidor:
- `src/app/(auth)/mfa/acciones.ts` → `verificarMfa(codigo)`: busca el factor verificado y hace `challengeAndVerify`;
  las cookies de la sesión AAL2 las escribe el cliente de servidor. No redirige (navega el cliente, decisión 29).
- `src/app/(app)/ajustes/seguridad/acciones.ts` → `iniciarDosPasos`, `confirmarDosPasos`, `desactivarDosPasos`.
- `ajustes/seguridad/page.tsx` consulta el estado (`listFactors`) en el servidor y se lo pasa a `DosPasos`: la
  tarjeta ya no muestra «Consultando…» mientras el navegador pregunta.
- `verificar.tsx` y `dos-pasos.tsx` ya no importan `@/lib/supabase/client`. Ningún componente lo usa hoy; se deja
  por si llega algo que de verdad lo necesite en el navegador (p. ej. tiempo real).

**Para qué.** `createBrowserClient` trae supabase-js entero (Auth, PostgREST, Storage, Realtime): ~260 KB (68 KB
comprimidos). `/ajustes/seguridad` bajó de 344 KB a 90 KB y `/mfa` de ~365 KB a 105 KB. `/mfa` está en el
camino de ingreso de quien activó 2FA, casi siempre desde el celular.

**Si no se hace.** Quien tiene 2FA espera la descarga de ~260 KB extra cada vez que entra (sin caché, tras una
actualización de la app, o en un celular nuevo) antes de poder escribir el código. Además, el navegador tendría
otra vía a la API de Supabase distinta del resto de la app, que todo lo hace por acciones de servidor.

### 13. ✅ Movimientos: catálogos y movimientos en serie (regla `async-parallel`)

**Qué se hizo.** En `movimientos/page.tsx` la consulta de catálogos (cuentas, categorías, miembros, etiquetas) arranca
sin `await` y se espera junto con la de movimientos (`Promise.all`). Solo el filtro por categoría espera los
catálogos antes, porque necesita las subcategorías para armar el filtro.

**Para qué.** Antes la lista esperaba a que llegaran los catálogos para recién pedir los movimientos: dos viajes a
la base uno tras otro. Ahora es uno (salvo con filtro de categoría). Ahorra un viaje (~10–30 ms con Vercel y
Supabase en `gru1`) en la pantalla más usada.

**Si no se hace.** Cada apertura de Movimientos tarda un viaje de más. Es poco por vez, pero es la pantalla que más
se abre y el retraso crece si la base está lejos o cargada.

### 14. ✅ Editar movimiento: movimiento y catálogos en serie (regla `async-parallel`)

**Qué se hizo.** En `movimientos/[id]/page.tsx` el movimiento y los catálogos del formulario se piden juntos. Los
catálogos solo se piden si la persona puede editar (`ctx.puedeEditar`): el contador no los necesita.

**Para qué y si no se hace.** Igual que la 13: un viaje a la base menos al abrir un movimiento.

### 15. 🟢 Pendiente: trazos de íconos y logo con menos precisión (regla `rendering-svg-precision`)

**Qué.** `src/components/marca-datos.ts` pesa 60 KB: las curvas están guardadas como miles de puntos con 2 decimales.
Pasarlas por SVGO (curvas reales, coordenadas relativas, 1 decimal) dentro del script que genera el archivo las
dejaría en ~15–20 KB. No se edita a mano: el archivo se genera desde el sistema de diseño.

**Por qué importa.** Ese archivo va en el JS de todas las pantallas (los íconos se usan en toda la app).

**Si no se hace.** ~40 KB de más en la primera visita y tras cada actualización; después el navegador lo guarda.
Impacto bajo; por eso quedó para después.

---

## Recomendaciones de la skill que NO aplican aquí

Se dejan anotadas para que nadie las «arregle» por error:

| Recomendación | Por qué no |
| --- | --- |
| `loading.tsx` en cada página | Decisión 15: con esqueleto por página React lo retiene ≥ 300 ms; sin él la navegación baja a ~100 ms. |
| `next/image` para todas las imágenes | El único `<img>` es el QR del 2FA, una imagen `data:` generada al momento; `next/image` no la optimiza. |
| Caché con `fetch(..., { cache })` / `revalidate` | Los datos vienen de supabase-js y son financieros: frescura > velocidad. No se cachean a propósito. |
| Open Graph, URL canónica, sitemap | Sirven para sitios públicos; esta app es privada (ver mejora 6). |

## Lo que ya cumple

Componentes de servidor por defecto (ninguna `page.tsx` es de cliente) · las 14 acciones de servidor revisan sesión y
rol en el servidor y casi todas validan con zod · capa de acceso a datos con `server-only` · llaves de API solo en el
servidor · `/auth/confirmar` limpia el destino con `destinoSeguro` · metadata con plantilla de título en las 27
páginas · `next/font` · manifest de PWA · encabezados de seguridad básicos · `error.tsx` y `not-found.tsx` con la API
de Next 16.4 (`retry`) · ESLint sin advertencias.
