# Despliegue: Supabase Cloud + Vercel

Guía para publicar My House por primera vez. Toma unos 20 minutos. Al final la app queda en una URL
`https://…vercel.app` (o su dominio) que se instala como PWA en el celular.

## 1. Supabase Cloud

1. Cree un proyecto en <https://supabase.com/dashboard> (región **São Paulo** `sa-east-1`, la más cercana a
   Colombia). Guarde la contraseña de la base de datos en su gestor de contraseñas.
2. Vincule el repositorio y suba las migraciones (desde la raíz del proyecto):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```

   Esto crea las tablas, las políticas RLS, las funciones, el bucket `soportes`, el catálogo tributario de
   Colombia y la tarea diaria de `pg_cron` que programa los gastos recurrentes.
3. **Authentication → Providers → Email:** deje activa la confirmación de correo.
4. **Authentication → Multi-Factor:** active **TOTP** (inscripción y verificación).
5. **Authentication → URL Configuration:**
   - *Site URL:* la URL de producción (por ejemplo `https://myhouse.vercel.app`).
   - *Redirect URLs:* agregue `https://myhouse.vercel.app/**` (y la de previews de Vercel si las usa).
6. **Authentication → Hooks → Customize Access Token (JWT) Claims:** actívelo con la función de Postgres
   `public.custom_access_token_hook`. Pone el hogar y el rol en el token: las páginas no consultan la base para
   saber quién es el usuario (sin él la app funciona, pero cada página hace una consulta más).
7. **Project Settings → API:** copie la URL del proyecto y la llave `anon` (pública).
8. Opcional pero recomendado: **Authentication → SMTP** con un proveedor propio (Resend, Brevo…). El correo
   integrado de Supabase tiene un límite bajo de envíos por hora.

## 2. Vercel

1. Importe el repositorio `Jaider45/My-House` en <https://vercel.com/new> (framework: Next.js, sin cambios).
   `vercel.json` fija la región `gru1` (São Paulo), la misma de Supabase: cada consulta cruza la ciudad y no el
   continente (~5 ms en vez de ~120 ms).
2. Variables de entorno (Production y Preview):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave `anon` |
   | `NEXT_PUBLIC_SITE_URL` | URL de producción, sin `/` al final |
   | `ANTHROPIC_API_KEY` | Llave de Anthropic para el asistente con Claude (opcional) |
   | `OPENAI_API_KEY` | Llave de OpenAI para el asistente con GPT (opcional) |
   | `IA_PROVEEDOR`, `ANTHROPIC_MODEL`, `OPENAI_MODEL` | Opcionales: proveedor y modelos por defecto |

   El asistente de comprobantes y la importación de PDF necesitan **al menos una** de las dos llaves. Con las dos,
   cada hogar elige proveedor y modelo en Configuración → Hogar → Asistente de IA. Las llaves solo viven en el
   servidor; la base guarda únicamente qué proveedor y modelo eligió el hogar. Con OpenAI se envía `store: false`.

   **No** agregue `SUPABASE_SERVICE_ROLE_KEY` en Vercel: la app no la usa (solo las pruebas locales).
3. Despliegue. Si cambia la URL (dominio propio), actualice `NEXT_PUBLIC_SITE_URL` y las URLs de Supabase.

## 3. Primer uso

1. Abra la URL en el celular, cree su cuenta (confirme el correo) y luego el hogar.
2. **Ajustes → Seguridad:** active la verificación en dos pasos.
3. **Ajustes → Miembros:** invite a su pareja y comparta el enlace por WhatsApp.
4. Cree las cuentas (con su titular), revise las categorías y agregue los gastos recurrentes.
5. Instale la app: en Android, Chrome ofrece «Instalar app»; en iPhone, Safari → Compartir → «Agregar a
   inicio».

## 4. Después

- **Nuevas migraciones:** `npx supabase db push` (nunca edite una migración ya aplicada; cree otra con
  `npx supabase migration new <nombre>`).
- **UVT de un año nuevo:** cree una migración que inserte la fila en `tax_params` (país, año, valor). Los topes
  se guardan en UVT y los pesos se calculan solos.
- **Respaldo:** el plan gratuito de Supabase no tiene copias diarias descargables. Para datos de una familia,
  un `npx supabase db dump --data-only > respaldo.sql` mensual guardado fuera de la nube es suficiente.
