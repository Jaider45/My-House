// Sube a Supabase Cloud los correos de acceso con el diseño de My House: las 5 plantillas de supabase/templates/
// con sus asuntos (los mismos de supabase/config.toml), la vigencia de 30 min y el SMTP de Resend.
// Reemplaza copiar y pegar en Authentication → Emails. Solo toca esos campos: no cambia URLs, captcha ni proveedores.
//
// Uso:  node scripts/subir-correos-supabase.mjs              (plantillas + SMTP)
//       node scripts/subir-correos-supabase.mjs --sin-smtp   (solo plantillas y asuntos)
//
// Lee de las variables de entorno o de .env.produccion.local:
//   SUPABASE_ACCESS_TOKEN   token personal (supabase.com/dashboard/account/tokens)
//   NEXT_PUBLIC_SUPABASE_URL  https://<ref>.supabase.co
//   RESEND_API_KEY, CORREO_REMITENTE («My House <no-responder@dominio>»)  — solo para el SMTP
//
// Antes de subir: si cambiaste el diseño, regenera las plantillas con
//   ACTUALIZAR_CORREOS=1 npx vitest run src/lib/correo
import { existsSync, readFileSync } from "node:fs";

const leer = (ruta) =>
  existsSync(ruta)
    ? Object.fromEntries(
        readFileSync(ruta, "utf8")
          .split(/\r?\n/)
          .filter((l) => /^[A-Z_]+=/.test(l))
          .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
      )
    : {};
const archivo = leer(".env.produccion.local");
const env = (k) => process.env[k] || archivo[k] || "";

const TOKEN = env("SUPABASE_ACCESS_TOKEN");
const URL_PROYECTO = env("NEXT_PUBLIC_SUPABASE_URL");
const ref = URL_PROYECTO.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1];
const conSmtp = !process.argv.includes("--sin-smtp");

if (!TOKEN) {
  console.error("Falta SUPABASE_ACCESS_TOKEN (créalo en supabase.com/dashboard/account/tokens y agrégalo a .env.produccion.local).");
  process.exit(1);
}
if (!ref) {
  console.error(`NEXT_PUBLIC_SUPABASE_URL no es un proyecto de Supabase Cloud: «${URL_PROYECTO}».`);
  process.exit(1);
}

// Asuntos y archivos: la fuente es config.toml (así local y nube no se separan).
const toml = readFileSync("supabase/config.toml", "utf8");
function seccion(nombre) {
  const bloque = toml.split(`[${nombre}]`)[1]?.split(/\n\[/)[0];
  if (!bloque) throw new Error(`No encontré [${nombre}] en supabase/config.toml`);
  const valor = (k) => bloque.match(new RegExp(`^${k}\\s*=\\s*"(.*)"`, "m"))?.[1];
  const ruta = valor("content_path").replace(/^\.\/supabase\//, "supabase/");
  return { asunto: valor("subject"), html: readFileSync(ruta, "utf8") };
}
const t = {
  confirmation: seccion("auth.email.template.confirmation"),
  recovery: seccion("auth.email.template.recovery"),
  magic_link: seccion("auth.email.template.magic_link"),
  email_change: seccion("auth.email.template.email_change"),
  password_changed: seccion("auth.email.notification.password_changed"),
};

const cambios = {
  mailer_otp_exp: 1800,
  mailer_subjects_confirmation: t.confirmation.asunto,
  mailer_templates_confirmation_content: t.confirmation.html,
  mailer_subjects_recovery: t.recovery.asunto,
  mailer_templates_recovery_content: t.recovery.html,
  mailer_subjects_magic_link: t.magic_link.asunto,
  mailer_templates_magic_link_content: t.magic_link.html,
  mailer_subjects_email_change: t.email_change.asunto,
  mailer_templates_email_change_content: t.email_change.html,
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: t.password_changed.asunto,
  mailer_templates_password_changed_notification_content: t.password_changed.html,
};

if (conSmtp) {
  const llave = env("RESEND_API_KEY");
  const remitente = env("CORREO_REMITENTE").match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!llave || !remitente) {
    console.error("Para el SMTP faltan RESEND_API_KEY o CORREO_REMITENTE («My House <no-responder@dominio>»). Usa --sin-smtp para subir solo las plantillas.");
    process.exit(1);
  }
  Object.assign(cambios, {
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: llave,
    smtp_admin_email: remitente[2],
    smtp_sender_name: remitente[1] || "My House",
  });
}

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const cabeceras = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const r = await fetch(api, { method: "PATCH", headers: cabeceras, body: JSON.stringify(cambios) });
if (!r.ok) {
  console.error(`Supabase respondió ${r.status}: ${(await r.text()).slice(0, 500)}`);
  process.exit(1);
}

// Verificación: se relee la configuración y se compara campo por campo (la contraseña SMTP no vuelve).
const actual = await (await fetch(api, { headers: cabeceras })).json();
const distintos = Object.keys(cambios).filter((k) => k !== "smtp_pass" && String(actual[k]) !== String(cambios[k]));
if (distintos.length) {
  console.error(`Se guardó, pero estos campos no quedaron iguales: ${distintos.join(", ")}`);
  process.exit(1);
}
console.log(`Listo (${ref}): 5 plantillas y asuntos, códigos de 30 min${conSmtp ? `, SMTP Resend como ${cambios.smtp_sender_name} <${cambios.smtp_admin_email}>` : ""}.`);
console.log(`Envío de correos por hora: ${actual.rate_limit_email_sent ?? "?"} (Authentication → Rate Limits; súbelo si esperas muchos registros).`);
