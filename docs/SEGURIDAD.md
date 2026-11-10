# Seguridad de My House

Qué protege la app, dónde está cada protección y qué prueba la verifica. Se corre con `npm run check` (unitarias) y
`npm run test:rls` (contra la base local). Si alguien rompe una de estas reglas, las pruebas fallan.

## 1. La API no la usa cualquiera

La app expone la API de Supabase (PostgREST) con una llave pública: así funciona Supabase. Lo que impide que alguien
lea o cambie datos con esa llave es la base misma:

| Protección | Dónde | Prueba |
| --- | --- | --- |
| Toda tabla tiene RLS (cada hogar solo ve lo suyo) | migraciones, `private.mis_hogares()` | `aislamiento-hogares.test.ts` |
| Sin sesión solo se pueden ver invitaciones (2 funciones); nada más | `revision_seguridad()` | `seguridad.test.ts` |
| Tablas sensibles (auditoría, integraciones, cupones, eventos de pago, notas) sin ningún permiso directo | `revoke all … from anon, authenticated` | `seguridad.test.ts` |
| Vistas con `security_invoker` (no se saltan RLS) | `account_balances` | `revision_seguridad()` |
| Funciones con permisos de dueño fijan `search_path` (no se pueden secuestrar) | todas las `security definer` | `revision_seguridad()` |
| Funciones de servidor (confirmar pagos, vencimientos, leer secretos) solo con service_role | `grant … to service_role` | `seguridad.test.ts` |
| Bucket de soportes privado, con tamaño y tipos limitados | `storage` | `revision_seguridad()` |
| Rutas `/api/*`: cron con `CRON_SECRET` en tiempo constante; webhooks con firma (Wompi: checksum; WhatsApp: HMAC del secreto de la app) | `src/app/api` | `wompi.test.ts`, `servidor.test.ts`, E2E |
| Consola: persona del equipo activa + verificación en dos pasos exigida **en la base** + permiso del rol, auditado | `private.exigir_staff` | `consola.test.ts` |

`revision_seguridad()` (migración `integraciones`) revisa la configuración completa en cada corrida de pruebas: tablas
sin RLS, vistas inseguras, funciones expuestas, `search_path`, permisos sobre tablas sensibles y buckets públicos.

## 2. Nadie se cambia el plan sin pagar

- El precio lo calcula la base (`cotizar_plan`); el navegador solo dice qué plan y periodo quiere.
- `households.plan`, `prueba_hasta` y `estado` no se pueden cambiar con un `update` (trigger `proteger_plan`).
- `suscripciones` y `cobros` no aceptan escrituras desde el navegador.
- Solo el webhook de Wompi confirma un pago: firma verificada, monto exacto en centavos, una vez por evento.
- Cambiar el plan desde la consola exige el permiso `cobros`, la verificación en dos pasos y queda en la auditoría.
- Crear cobros tiene tope (20 por hogar por hora).

Prueba: `seguridad.test.ts` («cambiar el plan sin pagar») intenta cada camino y verifica que el hogar sigue en Gratis.

## 3. Inyección SQL y de filtros

- Ninguna consulta arma SQL con texto del usuario: supabase-js manda parámetros y las funciones SQL usan argumentos
  (los únicos `format()` son de nombres fijos dentro de migraciones).
- Los filtros de PostgREST que llevan un valor del usuario (`or(...)`) solo aceptan UUID validados (decisión 28).
- Las búsquedas escapan `%` y `_`.

Prueba: `seguridad.test.ts` («inyección») manda `'; drop table …` y `' or 1=1 --` a las búsquedas.

## 4. Navegador

| Protección | Dónde |
| --- | --- |
| XSS: React escapa todo; el único HTML crudo es el de los íconos propios (constantes) | `marca.tsx` |
| Correos: todo texto del usuario se escapa | `plantilla.ts` (prueba en `plantilla.test.ts`) |
| CSP sin `unsafe-eval`, solo orígenes conocidos (Supabase, Turnstile, Google, Wompi). Probada en modo obligatorio sin violaciones | `next.config.ts` |
| `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` |
| HTTPS forzado (HSTS) | Vercel lo agrega en todos los despliegues |
| CSRF: las acciones de servidor comparan Origin y Host; cookies de sesión `SameSite=Lax` | Next.js, Supabase |
| Redirecciones solo a rutas internas | `destinoSeguro`, `destinoConsola` |

## 5. Cuentas

Captcha (Turnstile), verificación en dos pasos (obligatoria para el equipo), aviso de inicio de sesión desde un
dispositivo nuevo, contraseña actual con pausa ante fallos, cierre de otras sesiones al cambiarla, consola con cierre
por inactividad y auditoría inmutable. Límites de Supabase Auth contra fuerza bruta.

## 6. Secretos

- Llaves de proveedores: en la consola (Integraciones), cifradas en Supabase Vault. El equipo puede escribirlas pero
  nunca volver a verlas (solo los últimos 4 caracteres). Solo el servidor las descifra.
- `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` solo como variables del servidor (nunca `NEXT_PUBLIC_`).
- `.env.local` nunca va al repositorio.

## 7. Pendiente antes de producción

1. `CSP_MODO=activa` en Vercel (hoy sale en modo Report-Only; ya se probó obligatoria en local sin violaciones).
2. Activar el captcha y las contraseñas filtradas en Supabase (DESPLIEGUE §1.2 y §1.4).
3. Plan Pro de Supabase para respaldos diarios.
4. Opcional: Vercel Firewall / BotID para limitar peticiones por IP a las acciones de servidor.
