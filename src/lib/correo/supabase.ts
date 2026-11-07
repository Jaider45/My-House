import { correoCambioCorreo, correoCodigo, correoContrasena, correoRegistro, correoRestablecer } from "./correos";
import { armarCorreo, crudo } from "./plantilla";

/**
 * Plantillas de los correos que envía Supabase Auth, armadas con el mismo diseño que los de la app. Llevan variables
 * de Go (`{{ .Token }}`, `{{ .ConfirmationURL }}`…) que Supabase reemplaza al enviar. Se escriben en
 * supabase/templates/ con `ACTUALIZAR_CORREOS=1 npx vitest run src/lib/correo` y se pegan en el panel de la nube.
 */

/** Vigencia de códigos y enlaces: `otp_expiry` de supabase/config.toml (y «Email OTP Expiration» en la nube). */
export const MINUTOS_OTP = 30;

const SITIO = crudo("{{ .SiteURL }}");
// Nombre del registro si existe (user_metadata.nombre); Supabase escapa el valor.
const HOLA = crudo("{{ if .Data.nombre }}Hola {{ .Data.nombre }},{{ else }}Hola,{{ end }}");

export const PLANTILLAS_SUPABASE = {
  "codigo.html": {
    seccion: "auth.email.template.magic_link",
    contenido: correoCodigo({
      hola: HOLA,
      codigo: crudo("{{ slice .Token 0 3 }} {{ slice .Token 3 }}"),
      asuntoCodigo: crudo("{{ .Token }}"),
      minutos: MINUTOS_OTP,
    }),
  },
  "recuperacion.html": {
    seccion: "auth.email.template.recovery",
    contenido: correoRestablecer({ hola: HOLA, url: crudo("{{ .ConfirmationURL }}"), minutos: MINUTOS_OTP }),
  },
  "confirmacion.html": {
    seccion: "auth.email.template.confirmation",
    contenido: correoRegistro({ hola: HOLA, url: crudo("{{ .ConfirmationURL }}"), minutos: MINUTOS_OTP }),
  },
  "cambio-correo.html": {
    seccion: "auth.email.template.email_change",
    contenido: correoCambioCorreo({ hola: HOLA, url: crudo("{{ .ConfirmationURL }}"), actual: crudo("{{ .Email }}"), nuevo: crudo("{{ .NewEmail }}") }),
  },
  "contrasena-cambiada.html": {
    seccion: "auth.email.notification.password_changed",
    contenido: correoContrasena({ hola: HOLA, urlRecuperar: crudo("{{ .SiteURL }}/recuperar?email={{ .Email }}") }),
  },
} as const;

export function plantillaSupabase(archivo: keyof typeof PLANTILLAS_SUPABASE) {
  return armarCorreo(PLANTILLAS_SUPABASE[archivo].contenido, SITIO);
}
