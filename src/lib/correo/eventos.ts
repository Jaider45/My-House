import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Eventos de Resend (webhook /api/correos/webhook): entregado, abierto, clic, rebote. Resend firma con Svix:
 * HMAC-SHA256 en base64 de `id.timestamp.cuerpo` con el secreto (tras el prefijo whsec_). Funciones puras,
 * probadas en eventos.test.ts.
 */

const TOLERANCIA_SEGUNDOS = 5 * 60;

export function firmaSvixValida(
  cuerpo: string,
  cabeceras: { id: string | null; timestamp: string | null; firma: string | null },
  secreto: string,
  ahora: Date = new Date(),
): boolean {
  if (!cabeceras.id || !cabeceras.timestamp || !cabeceras.firma || !secreto) return false;
  const ts = Number(cabeceras.timestamp);
  if (!Number.isFinite(ts) || Math.abs(ahora.getTime() / 1000 - ts) > TOLERANCIA_SEGUNDOS) return false;
  let llave: Buffer;
  try {
    llave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  } catch {
    return false;
  }
  const esperada = createHmac("sha256", llave).update(`${cabeceras.id}.${cabeceras.timestamp}.${cuerpo}`).digest("base64");
  // La cabecera trae una o varias firmas: "v1,xxx v1,yyy".
  return cabeceras.firma.split(" ").some((parte) => {
    const [version, valor] = parte.split(",");
    if (version !== "v1" || !valor) return false;
    const a = Buffer.from(valor);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

const ORDEN = ["enviado", "entregado", "abierto", "clic"] as const;
export type EstadoCorreo = (typeof ORDEN)[number] | "rebotado" | "queja";

/** Estado que deja un evento de Resend, o null si el evento no nos interesa. */
export function estadoDeEvento(tipo: string): EstadoCorreo | null {
  switch (tipo) {
    case "email.sent":
      return "enviado";
    case "email.delivered":
      return "entregado";
    case "email.opened":
      return "abierto";
    case "email.clicked":
      return "clic";
    case "email.bounced":
      return "rebotado";
    case "email.complained":
      return "queja";
    default:
      return null;
  }
}

/** Un estado solo avanza (entregado no pisa a abierto); rebote y queja siempre quedan. */
export function estadoQueQueda(actual: string, nuevo: EstadoCorreo): EstadoCorreo | null {
  if (nuevo === "rebotado" || nuevo === "queja") return nuevo;
  if (actual === "rebotado" || actual === "queja") return null;
  const a = ORDEN.indexOf(actual as (typeof ORDEN)[number]);
  const n = ORDEN.indexOf(nuevo);
  return n > a ? nuevo : null;
}
