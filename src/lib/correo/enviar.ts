import "server-only";
import { leerIntegracion } from "@/lib/integraciones/servidor";
import { armarCorreo, type Contenido } from "./plantilla";

/**
 * Envío de los correos propios de la app (los de acceso los envía Supabase). Orden:
 * 1. Resend, si está conectado en la consola (Integraciones) o con RESEND_API_KEY (producción).
 * 2. Mailpit de Supabase local, si la base es local (desarrollo: se ven en http://127.0.0.1:54324).
 * 3. Ninguno: no se envía y se avisa en el log. Un correo que falla nunca rompe la acción que lo pidió.
 */

export const sitio = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const REMITENTE_POR_DEFECTO = "My House <no-responder@myhouse.test>";

type Destino = { para: string; contenido: Contenido; etiqueta?: string; cabeceras?: Record<string, string> };
export type Resultado = { enviado: boolean; via: "resend" | "mailpit" | "ninguno"; error?: string };

function mailpit(): string | null {
  if (process.env.CORREO_MAILPIT_URL) return process.env.CORREO_MAILPIT_URL;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return /\/\/(127\.0\.0\.1|localhost)[:/]/.test(base) && process.env.NODE_ENV !== "test" ? "http://127.0.0.1:54324" : null;
}

/** ¿Hay por dónde enviar? Para decidir qué decirle a la persona (p. ej. «te enviamos la invitación»). */
export const puedeEnviarCorreo = async () => Boolean((await leerIntegracion("resend")) || mailpit());

/**
 * Envía con Resend (o Mailpit en local). `probarCon`: llave y remitente aún sin guardar, para el botón «Enviar correo de
 * prueba» de la consola (así se confirma una llave de solo envío, que no puede listar nada en Resend).
 */
export async function enviarCorreo({ para, contenido, etiqueta, cabeceras, probarCon }: Destino & { probarCon?: { api_key: string; remitente?: string } }): Promise<Resultado> {
  const { asunto, html, texto } = armarCorreo(contenido, sitio());
  const resend = probarCon ?? (await leerIntegracion("resend"))?.valores;
  const remitente = resend?.remitente || process.env.CORREO_REMITENTE || REMITENTE_POR_DEFECTO;
  try {
    if (resend?.api_key) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resend.api_key}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: remitente,
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
      const [, nombre, correo] = remitente.match(/^(.*?)\s*<(.+)>$/) ?? [null, "My House", remitente];
      const r = await fetch(`${local}/api/v1/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ From: { Email: correo, Name: nombre }, To: [{ Email: para }], Subject: asunto, HTML: html, Text: texto, Headers: cabeceras, Tags: etiqueta ? [etiqueta] : undefined }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!r.ok) throw new Error(`Mailpit ${r.status}`);
      return { enviado: true, via: "mailpit" };
    }
    console.warn(`[correo] Resend no está conectado: no se envió «${asunto}» a ${para}`);
    return { enviado: false, via: "ninguno" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[correo] falló «${asunto}» a ${para}: ${error}`);
    return { enviado: false, via: resend?.api_key ? "resend" : "mailpit", error };
  }
}
