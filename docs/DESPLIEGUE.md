# Despliegue: Supabase Cloud + Vercel

Guía para publicar My House por primera vez. Toma unos 40 minutos con el correo, el captcha y Google. Al final la
app queda en una URL `https://…vercel.app` (o tu dominio) que se instala como PWA en el celular.

## 1. Supabase Cloud

1. Crea un proyecto en <https://supabase.com/dashboard> (región **São Paulo** `sa-east-1`, la más cercana a
   Colombia). Guarda la contraseña de la base de datos en tu gestor de contraseñas.
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

El correo integrado de Supabase manda muy pocos correos por hora: sin uno propio, la recuperación de contraseña y
el ingreso con código fallan en cuanto varias personas los usan.

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
5. **Authentication → Emails → Templates:** pega el contenido de cada archivo de `supabase/templates/` con su asunto
   (en local ya los usa `supabase/config.toml`):

   | Plantilla en Supabase | Archivo | Asunto |
   | --- | --- | --- |
   | Confirm signup | `confirmacion.html` | Confirma tu correo en My House |
   | Reset password | `recuperacion.html` | Crea una contraseña nueva para My House |
   | Magic link | `codigo.html` | Tu código para entrar a My House |
   | Change email address | `cambio-correo.html` | Confirma tu correo nuevo en My House |
   | Password changed (notificación) | `contrasena-cambiada.html` | Tu contraseña de My House cambió |

   La de *Magic link* muestra el código de 6 dígitos del ingreso sin contraseña: no la cambies por un enlace.

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
   `vercel.json` fija la región `gru1` (São Paulo), la misma de Supabase: cada consulta cruza la ciudad y no el
   continente (~5 ms en vez de ~120 ms).
2. Variables de entorno (Production y Preview):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave `anon` |
   | `NEXT_PUBLIC_SITE_URL` | URL de producción, sin `/` al final |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | *Site key* de Turnstile (si activaste el captcha, 1.2) |
   | `NEXT_PUBLIC_GOOGLE_ACTIVO` | `1` si activaste Google (1.3) |
   | `ANTHROPIC_API_KEY` | Llave de Anthropic para el asistente con Claude (opcional) |
   | `OPENAI_API_KEY` | Llave de OpenAI para el asistente con GPT (opcional) |
   | `IA_PROVEEDOR`, `ANTHROPIC_MODEL`, `OPENAI_MODEL` | Opcionales: proveedor y modelos por defecto |

   El asistente de comprobantes y la importación de PDF necesitan **al menos una** de las dos llaves de IA. Con las
   dos, cada hogar elige proveedor y modelo en Configuración → Hogar → Asistente de IA. Las llaves solo viven en el
   servidor; la base guarda únicamente qué proveedor y modelo eligió el hogar. Con OpenAI se envía `store: false`.

   **No** agregues `SUPABASE_SERVICE_ROLE_KEY` en Vercel: la app no la usa (solo las pruebas locales).
3. Despliega. Si cambia la URL (dominio propio), actualiza `NEXT_PUBLIC_SITE_URL`, las URLs de Supabase, el dominio
   del widget de Turnstile y los orígenes de Google.

## 3. Primer uso

1. Abre la URL en el celular, crea tu cuenta (confirma el correo) y luego el hogar.
2. **Configuración → Seguridad:** activa la verificación en dos pasos.
3. **Configuración → Miembros:** invita a tu pareja y comparte el enlace por WhatsApp.
4. Crea las cuentas (con su titular), revisa las categorías y agrega los gastos recurrentes.
5. Instala la app: en Android, Chrome ofrece «Instalar app»; en iPhone, Safari → Compartir → «Agregar a
   inicio».
6. Prueba una vez «¿Olvidaste tu contraseña?» y «Con código al correo» para confirmar que el correo llega (y que
   no cae en spam).

## 4. Después

- **Nuevas migraciones:** `npx supabase db push` (nunca edites una migración ya aplicada; crea otra con
  `npx supabase migration new <nombre>`).
- **UVT de un año nuevo:** crea una migración que inserte la fila en `tax_params` (país, año, valor). Los topes
  se guardan en UVT y los pesos se calculan solos.
- **Respaldo:** el plan gratuito de Supabase no tiene copias diarias descargables. Para datos de una familia,
  un `npx supabase db dump --data-only > respaldo.sql` mensual guardado fuera de la nube es suficiente.
