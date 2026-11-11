# Despliegue: Supabase Cloud + Vercel

Guía para publicar My House por primera vez. Toma unos 40 minutos con el correo, el captcha y Google. Al final la
app queda en una URL `https://…vercel.app` (o tu dominio) que se instala como PWA en el celular.

## 1. Supabase Cloud

1. Crea un proyecto en <https://supabase.com/dashboard>. El de My House está en **us-east-1** (Virginia); la
   región debe coincidir con la de Vercel en `vercel.json` (ver §2). Guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. Vincula el repositorio y sube las migraciones (desde la raíz del proyecto):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```

   Esto crea las tablas, las políticas RLS, las funciones, el bucket `soportes`, el catálogo tributario de
   Colombia y la tarea diaria de `pg_cron` que programa los gastos recurrentes.
3. **Authentication → Providers → Email:** deja activa la confirmación de correo.
4. **Authentication → Multi-Factor:** activa **TOTP** (inscripción y verificación).
5. **Authentication → URL Configuration:**
   - *Site URL:* la URL de producción (por ejemplo `https://myhouse.vercel.app`).
   - *Redirect URLs:* agrega `https://myhouse.vercel.app/**` (y la de previews de Vercel si las usas).
6. **Authentication → Hooks → Customize Access Token (JWT) Claims:** actívalo con la función de Postgres
   `public.custom_access_token_hook`. Pone en el token el hogar, el rol y si la persona tiene verificación en dos
   pasos: así el proxy y las páginas no consultan la base ni Auth en cada clic (sin él la app funciona, más lenta).
7. **Project Settings → API:** copia la URL del proyecto y la llave `anon` (pública).

### 1.1 Correo propio (Resend) y plantillas en español

Hay dos tipos de correo. Los de **acceso** (código, restablecer, confirmar registro, cambio de correo y contraseña
cambiada) los envía **Supabase**. Los demás (bienvenida, invitaciones, nuevo inicio de sesión, recordatorios, pagos
vencidos, resumen semanal y Renta DIAN) los envía **la app** con la API de Resend. Los dos usan el mismo diseño
(`src/lib/correo`) y la misma cuenta de Resend. El correo integrado de Supabase manda muy pocos por hora: sin uno
propio, la recuperación de contraseña y el ingreso con código fallan en cuanto varias personas los usan.

1. Crea una cuenta en <https://resend.com>, agrega tu dominio (**Domains → Add domain**) y copia los registros DNS
   que te muestra (SPF, DKIM) en tu proveedor de dominio. Espera a que aparezca «Verified».
2. **API Keys → Create API key** con permiso *Sending access*.
3. En Supabase, **Authentication → Emails → SMTP Settings → Enable custom SMTP**:

   | Campo | Valor |
   | --- | --- |
   | Sender email | `no-responder@tu-dominio.com` |
   | Sender name | `My House` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | la API key de Resend |

4. **Authentication → Rate Limits:** sube «emails per hour» (por ejemplo a 100).
   **Authentication → Providers → Email → Email OTP Expiration:** `1800` segundos (los correos dicen «vence en 30
   minutos»).
5. **Authentication → Emails → Templates:** pega el contenido de cada archivo de `supabase/templates/` con su asunto
   (en local ya los usa `supabase/config.toml`):

   | Plantilla en Supabase | Archivo | Asunto |
   | --- | --- | --- |
   | Confirm signup | `confirmacion.html` | Confirma tu correo para activar tu cuenta de My House |
   | Reset password | `recuperacion.html` | Restablece tu contraseña de My House |
   | Magic link | `codigo.html` | `Tu código de My House: {{ .Token }}` |
   | Change email address | `cambio-correo.html` | Confirma tu correo nuevo en My House |
   | Password changed (notificación) | `contrasena-cambiada.html` | Tu contraseña de My House cambió |

   La de *Magic link* muestra el código de 6 dígitos del ingreso sin contraseña: no la cambies por un enlace. Las
   imágenes (logo e íconos) se cargan desde `{{ .SiteURL }}/correo/`: el *Site URL* del paso 5 debe ser el de
   producción. Las plantillas se generan desde el código: si cambias el diseño, regenéralas con
   `ACTUALIZAR_CORREOS=1 npx vitest run src/lib/correo` y vuelve a pegarlas.
6. **Avisos de la app:** con `RESEND_API_KEY` y `CORREO_REMITENTE` en Vercel (paso 2) la app envía sus correos.
   Los programados los corre Vercel Cron todos los días a las 7:00 a. m. de Bogotá (`vercel.json` →
   `/api/avisos`), protegido con `CRON_SECRET`; recorre todos los hogares, por eso necesita
   `SUPABASE_SERVICE_ROLE_KEY` (solo en el servidor). Para probarlo: `curl -H "Authorization: Bearer $CRON_SECRET"
   https://tu-dominio/api/avisos` responde cuántos avisos y correos salieron. Procesa los hogares por páginas de
   100 y, si quedan más o se acaba el tiempo, se vuelve a llamar sola (`siguiente` en la respuesta, máx. 30 vueltas; cada vuelta deja
   una línea `[avisos]` en los logs de Vercel). Envía 2 correos por segundo (límite por defecto de Resend; confírmalo en tu cuenta);
   con un plan mayor, sube `AVISOS_CORREOS_POR_SEGUNDO`.

### 1.2 Captcha (Cloudflare Turnstile)

Frena los robots que prueban contraseñas o crean cuentas en masa. Casi siempre es invisible.

1. En <https://dash.cloudflare.com> → **Turnstile → Add widget**: nombre `My House`, dominio de producción (y
   `localhost` si quieres probarlo en local), modo **Managed**. Copia la *Site key* y la *Secret key*.
2. En Supabase, **Authentication → Attack Protection → Enable Captcha protection**: proveedor *Turnstile*, pega la
   *Secret key*.
3. En Vercel agrega `NEXT_PUBLIC_TURNSTILE_SITE_KEY` con la *Site key* (paso 2 de Vercel) y vuelve a desplegar.

Activa las dos partes juntas: con el captcha encendido en Supabase pero sin la variable en Vercel nadie puede
ingresar. Para apagarlo, quita primero la protección en Supabase.

### 1.3 Ingreso con Google

1. En <https://console.cloud.google.com>: crea un proyecto → **APIs & Services → OAuth consent screen** (tipo
   *External*, nombre `My House`, tu correo de soporte, dominio de producción) → **Credentials → Create
   credentials → OAuth client ID** (tipo *Web application*).
   - *Authorized JavaScript origins:* la URL de producción.
   - *Authorized redirect URIs:* `https://<ref-del-proyecto>.supabase.co/auth/v1/callback`.
2. En Supabase, **Authentication → Providers → Google**: actívalo y pega el *Client ID* y el *Client secret*.
3. En Vercel agrega `NEXT_PUBLIC_GOOGLE_ACTIVO=1`. Sin esa variable el botón «Continuar con Google» no aparece.

### 1.4 Contraseñas filtradas

**Authentication → Attack Protection → Prevent use of leaked passwords** (requiere plan Pro): rechaza contraseñas
que aparecen en filtraciones conocidas (HaveIBeenPwned). La app ya muestra un medidor de fuerza al crearlas.

## 2. Vercel

1. Importa el repositorio `Jaider45/My-House` en <https://vercel.com/new> (framework: Next.js, sin cambios).
   `vercel.json` fija la región `iad1` (Washington), junto a Supabase `us-east-1`: cada consulta cruza la ciudad y
   no el continente (~5 ms en vez de ~120 ms). Si el proyecto de Supabase está en otra región, cambia `regions` a
   la de Vercel más cercana (São Paulo `sa-east-1` → `gru1`). La región de Supabase no se puede cambiar después.
2. Variables de entorno (Production y Preview):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave `anon` |
   | `NEXT_PUBLIC_SITE_URL` | URL de producción, sin `/` al final |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | *Site key* de Turnstile (si activaste el captcha, 1.2) |
   | `NEXT_PUBLIC_GOOGLE_ACTIVO` | `1` si activaste Google (1.3) |
   | `RESEND_API_KEY` | API key de Resend: correos de la app (1.1) |
   | `CORREO_REMITENTE` | `My House <no-responder@tu-dominio.com>` (dominio verificado en Resend) |
   | `CRON_SECRET` | Texto aleatorio largo (`openssl rand -hex 24`): protege `/api/avisos`. Vercel lo envía solo |
   | `SUPABASE_SERVICE_ROLE_KEY` | Llave `service_role`: solo la usa `/api/avisos` en el servidor |
   | `ANTHROPIC_API_KEY` | Llave de Anthropic para el asistente con Claude (opcional) |
   | `OPENAI_API_KEY` | Llave de OpenAI para el asistente con GPT (opcional) |
   | `IA_PROVEEDOR`, `ANTHROPIC_MODEL`, `OPENAI_MODEL` | Opcionales: proveedor y modelos por defecto |
   | `CSP_MODO` | Vacío al principio. `activa` cuando la CSP en modo Report-Only no muestre bloqueos (ver abajo) |

   El asistente de comprobantes y la importación de PDF necesitan **al menos una** de las dos llaves de IA. Con las
   dos, cada hogar elige proveedor y modelo en Configuración → Hogar → Asistente de IA. Las llaves solo viven en el
   servidor; la base guarda únicamente qué proveedor y modelo eligió el hogar. Con OpenAI se envía `store: false`.

   `SUPABASE_SERVICE_ROLE_KEY` salta RLS: nunca le pongas el prefijo `NEXT_PUBLIC_` y no la uses fuera de
   `src/app/api/avisos`. Si no quieres avisos programados, no la agregues: el resto de la app no la necesita.
   **Content Security Policy:** sale primero como `Content-Security-Policy-Report-Only`: el navegador no bloquea
   nada, solo avisa en la consola (DevTools → Console, mensajes «[Report Only]»). Usa la app unos días (ingreso con
   captcha y Google, 2FA, comprobantes, importar) y, si no aparece ningún aviso, agrega `CSP_MODO=activa` y
   redespliega. Si cambian los orígenes (otro proveedor de captcha, imágenes externas), ajústala en `next.config.ts`.
3. Despliega. Si cambia la URL (dominio propio), actualiza `NEXT_PUBLIC_SITE_URL`, las URLs de Supabase, el dominio
   del widget de Turnstile y los orígenes de Google.

### 2.1 Cobro de los planes (Wompi)

También se conecta sin variables desde la consola: **Integraciones → Pagos · Wompi** (cifra los secretos y prueba la
conexión). Lo mismo para Resend, WhatsApp, Anthropic y OpenAI. Las variables de entorno siguen funcionando como respaldo.


1. Crea la cuenta de comercio en <https://comercios.wompi.co> (necesita RUT o razón social).
2. **Desarrolladores → Llaves del API**: copia la llave pública, el secreto de integridad y el secreto de eventos. En
   el sandbox empiezan por `pub_test_`, `test_integrity_` y `test_events_`. Agrégalas en Vercel como
   `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET` (solo servidor, sin `NEXT_PUBLIC_`).
3. **Desarrolladores → URL de eventos**: `https://tu-dominio/api/pagos/wompi`. Es lo único que da por pagado un plan.
4. Prueba en sandbox con las tarjetas de prueba de Wompi: el plan pasa a Familia en segundos y llega el correo «Recibimos
   tu pago». En la consola, **Suscripciones y cobros** avisa si Wompi está en modo pruebas.
5. El cron `/api/cobros` (7:15 a. m.) renueva, avisa la mora y baja a Gratis al día 14. Usa `CRON_SECRET` y
   `SUPABASE_SERVICE_ROLE_KEY`, como `/api/avisos`.
6. Factura electrónica: falta elegir el proveedor (Alegra, Factus u otro con API). Mientras tanto los cobros quedan
   con factura «Pendiente» en la consola.

## 3. Primer uso

**Consola del equipo (`/consola`).** Para entrar tú primero, crea tu cuenta en `/registro` y dale el rol de superadmin
desde tu computador (la llave `service_role` no sale de ahí):

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<llave service_role> \
  node scripts/crear-superadmin.mjs tu@correo.com "Tu nombre"
```

Luego abre `https://tu-dominio/consola`: te pide activar la verificación en dos pasos (obligatoria para el equipo).
Al resto del equipo lo invitas desde **Equipo y permisos**.

1. Abre la URL en el celular, crea tu cuenta (confirma el correo) y luego el hogar.
2. **Configuración → Seguridad:** activa la verificación en dos pasos.
3. **Configuración → Miembros:** invita a tu pareja y comparte el enlace por WhatsApp.
4. Crea las cuentas (con su titular), revisa las categorías y agrega los gastos recurrentes.
5. Instala la app: en Android, Chrome ofrece «Instalar app»; en iPhone, Safari → Compartir → «Agregar a
   inicio».
6. Prueba una vez «¿Olvidaste tu contraseña?» y «Con código al correo» para confirmar que el correo llega (y que
   no cae en spam). En **Recordatorios** activa, si quieres, el resumen de los lunes.

## 4. Después

- **Nuevas migraciones:** `npx supabase db push` (nunca edites una migración ya aplicada; crea otra con
  `npx supabase migration new <nombre>`).
- **UVT de un año nuevo:** consola → **Parámetros DIAN** → «Cargar o editar un año» y luego «Publicar» (los hogares
  solo ven lo publicado). El calendario de vencimientos se pega ahí mismo cuando la DIAN lo publique.
- **Precios de la IA:** consola → **IA y automatizaciones**: carga el precio por millón de tokens de cada modelo para
  ver el costo del mes y, si quieres, un tope de gasto que pause las lecturas al alcanzarlo.
- **Mantenimiento:** `MANTENIMIENTO=1` en Vercel y volver a desplegar; quitarla para salir. Feature flags: consola →
  **Sistema**.
- **Solicitudes de datos (Ley 1581):** llegan desde Ayuda o al correo de datos; se atienden en consola → **Privacidad y
  auditoría**. La supresión borra archivos y la cuenta de Auth: requiere `SUPABASE_SERVICE_ROLE_KEY` en el servidor.
- **Respaldo:** el plan gratuito de Supabase no tiene copias diarias descargables. Para datos de una familia,
  un `npx supabase db dump --data-only > respaldo.sql` mensual guardado fuera de la nube es suficiente.
