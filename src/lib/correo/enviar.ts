import "server-only";
import { armarCorreo, type Contenido } from "./plantilla";

/**
 * Envío de los correos propios de la app (los de acceso los envía Supabase). Orden:
 * 1. Resend, si existe RESEND_API_KEY (producción).
 * 2. Mailpit de Supabase local, si la base es local (desarrollo: se ven en http://127.0.0.1:54324).
 * 3. Ninguno: no se envía y se avisa en el log. Un correo que falla nunca rompe la acción que lo pidió.
 */

export const sitio = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const REMITENTE = () => process.env.CORREO_REMITENTE ?? "My House <no-responder@myhouse.test>";

type Destino = { para: string; contenido: Contenido; etiqueta?: string; cabeceras?: Record<string, string> };
export type Resultado = { enviado: boolean; via: "resend" | "mailpit" | "ninguno"; error?: string };

function mailpit(): string | null {
  if (process.env.CORREO_MAILPIT_URL) return process.env.CORREO_MAILPIT_URL;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return /\/\/(127\.0\.0\.1|localhost)[:/]/.test(base) && process.env.NODE_ENV !== "test" ? "http://127.0.0.1:54324" : null;
}

/** ¿Hay por dónde enviar? Para decidir qué decirle a la persona (p. ej. «te enviamos la invitación»). */
export const puedeEnviarCorreo = () => Boolean(process.env.RESEND_API_KEY || mailpit());

export async function enviarCorreo({ para, contenido, etiqueta, cabeceras }: Destino): Promise<Resultado> {
  const { asunto, html, texto } = armarCorreo(contenido, sitio());
  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: REMITENTE(),
          to: [para],
          subject: asunto,
          html,
          text: texto,
          headers: cabeceras,
          tags: etiqueta ? [{ name: "tipo", value: etiqueta }] : undefined,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return { enviado: true, via: "resend" };
    }
    const local = mailpit();
    if (local) {
      const [, nombre, correo] = REMITENTE().match(/^(.*?)\s*<(.+)>$/) ?? [null, "My House", REMITENTE()];
      const r = await fetch(`${local}/api/v1/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ From: { Email: correo, Name: nombre }, To: [{ Email: para }], Subject: asunto, HTML: html, Text: texto, Headers: cabeceras, Tags: etiqueta ? [etiqueta] : undefined }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!r.ok) throw new Error(`Mailpit ${r.status}`);
      return { enviado: true, via: "mailpit" };
    }
    console.warn(`[correo] sin RESEND_API_KEY: no se envió «${asunto}» a ${para}`);
    return { enviado: false, via: "ninguno" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[correo] falló «${asunto}» a ${para}: ${error}`);
    return { enviado: false, via: process.env.RESEND_API_KEY ? "resend" : "mailpit", error };
  }
}
