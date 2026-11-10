import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";
import type { Proveedor } from "./catalogo";

/*
 * Configuración efectiva de cada integración: la conectada en la consola (secretos descifrados de Vault con
 * service_role) o, si no hay, la de las variables de entorno de antes. Caché en memoria de 60 s por instancia:
 * un cambio en la consola se nota en ese tiempo en todos los servidores (en el que lo guardó, al instante).
 */

export type Valores = Record<string, string>;
export type Lectura = { valores: Valores; origen: "consola" | "entorno" } | null;

const ENTORNO: Record<Proveedor, Record<string, string>> = {
  resend: { api_key: "RESEND_API_KEY", remitente: "CORREO_REMITENTE" },
  wompi: { llave_publica: "WOMPI_PUBLIC_KEY", integridad: "WOMPI_INTEGRITY_SECRET", eventos: "WOMPI_EVENTS_SECRET" },
  whatsapp: { phone_number_id: "WHATSAPP_PHONE_NUMBER_ID", waba_id: "WHATSAPP_WABA_ID", token: "WHATSAPP_TOKEN", app_secret: "WHATSAPP_APP_SECRET", verify_token: "WHATSAPP_VERIFY_TOKEN" },
  anthropic: { api_key: "ANTHROPIC_API_KEY", modelo: "ANTHROPIC_MODEL" },
  openai: { api_key: "OPENAI_API_KEY", modelo: "OPENAI_MODEL" },
};

/** Campos sin los que la integración no sirve. */
const REQUERIDOS: Record<Proveedor, string[]> = {
  resend: ["api_key"],
  wompi: ["llave_publica", "integridad", "eventos"],
  whatsapp: ["phone_number_id", "token"],
  anthropic: ["api_key"],
  openai: ["api_key"],
};

export function desdeEntorno(p: Proveedor, env: Record<string, string | undefined> = process.env): Valores | null {
  const v = Object.fromEntries(Object.entries(ENTORNO[p]).map(([k, nombre]) => [k, env[nombre]?.trim() ?? ""]).filter(([, x]) => x));
  return REQUERIDOS[p].every((k) => v[k]) ? v : null;
}

const cache = new Map<Proveedor, { hasta: number; lectura: Lectura }>();
const TTL = 60_000;

export function olvidar(p?: Proveedor) {
  if (p) cache.delete(p);
  else cache.clear();
}

/** Configuración efectiva (consola primero; si no, entorno). null = no conectada. */
export async function leerIntegracion(p: Proveedor): Promise<Lectura> {
  const c = cache.get(p);
  if (c && c.hasta > Date.now()) return c.lectura;
  let lectura: Lectura = null;
  if (hayServicio()) {
    const { data, error } = await crearClienteServicio().rpc("integracion_leer", { p_proveedor: p });
    if (error) console.error("[integraciones]", p, error.message);
    const d = data as { config?: Valores; secretos?: Valores } | null;
    if (d) {
      const valores = { ...(d.config ?? {}), ...(d.secretos ?? {}) };
      if (REQUERIDOS[p].every((k) => valores[k])) lectura = { valores, origen: "consola" };
    }
  }
  if (!lectura) {
    const env = desdeEntorno(p);
    if (env) lectura = { valores: env, origen: "entorno" };
  }
  cache.set(p, { hasta: Date.now() + TTL, lectura });
  return lectura;
}

export async function registrarEvento(p: Proveedor) {
  if (hayServicio()) await crearClienteServicio().rpc("integracion_evento", { p_proveedor: p });
}

// ───────────────────────────── pruebas de conexión ─────────────────────────────

export type Resultado = { ok: boolean; detalle: string; extra?: unknown };

const GRAPH = "https://graph.facebook.com/v23.0";
const tiempo = () => AbortSignal.timeout(10_000);

async function json(r: Response) {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Prueba la conexión con la API real del proveedor (no envía nada a nadie, salvo el correo de prueba aparte). */
export async function probar(p: Proveedor, v: Valores): Promise<Resultado> {
  try {
    switch (p) {
      case "resend": {
        // Las llaves recomendadas («Sending access») no pueden listar nada: se prueba enviando (ver enviarCorreo).
        return v.api_key?.startsWith("re_") ? { ok: true, detalle: "Llave con el formato correcto. Envía un correo de prueba para confirmarla." } : { ok: false, detalle: "La llave de Resend empieza por «re_»." };
      }
      case "wompi": {
        const base = v.llave_publica.startsWith("pub_test_") ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
        const r = await fetch(`${base}/merchants/${encodeURIComponent(v.llave_publica)}`, { signal: tiempo(), cache: "no-store" });
        const d = await json(r);
        if (!r.ok) return { ok: false, detalle: "Wompi no reconoce la llave pública." };
        const comercio = (d.data as { name?: string } | undefined)?.name ?? "comercio";
        const avisos = [!/_integrity_/.test(v.integridad) && "el secreto de integridad no parece de Wompi", !/_events_/.test(v.eventos) && "el secreto de eventos no parece de Wompi"].filter(Boolean);
        return { ok: avisos.length === 0, detalle: `${comercio} · ${base.includes("sandbox") ? "pruebas (sandbox)" : "producción"}${avisos.length ? ` · Revisa: ${avisos.join(", ")}` : ""}` };
      }
      case "whatsapp": {
        const auth = { authorization: `Bearer ${v.token}` };
        const r = await fetch(`${GRAPH}/${encodeURIComponent(v.phone_number_id)}?fields=display_phone_number,verified_name,quality_rating`, { headers: auth, signal: tiempo(), cache: "no-store" });
        const d = await json(r);
        if (!r.ok) return { ok: false, detalle: `Meta rechazó el token o el identificador del número: ${(d.error as { message?: string })?.message ?? r.status}` };
        let plantillas: { name: string; status: string; category: string; language: string }[] = [];
        if (v.waba_id) {
          const t = await fetch(`${GRAPH}/${encodeURIComponent(v.waba_id)}/message_templates?fields=name,status,category,language&limit=50`, { headers: auth, signal: tiempo(), cache: "no-store" });
          plantillas = t.ok ? (((await json(t)).data as typeof plantillas) ?? []) : [];
        }
        return { ok: true, detalle: `${d.verified_name ?? "Número"} · ${d.display_phone_number ?? ""} · calidad ${String(d.quality_rating ?? "—").toLowerCase()}`, extra: { plantillas } };
      }
      case "anthropic": {
        const base = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
        const r = await fetch(`${base}/v1/models?limit=100`, { headers: { "x-api-key": v.api_key, "anthropic-version": "2023-06-01" }, signal: tiempo(), cache: "no-store" });
        if (r.status === 401 || r.status === 403) return { ok: false, detalle: "La llave de Anthropic no es válida." };
        if (!r.ok) return { ok: false, detalle: `Anthropic respondió ${r.status}.` };
        const ids = (((await json(r)).data as { id: string }[]) ?? []).map((m) => m.id);
        if (v.modelo && !ids.includes(v.modelo)) return { ok: false, detalle: `Llave válida, pero el modelo «${v.modelo}» no está disponible para ella.` };
        return { ok: true, detalle: `Llave válida · ${ids.length} modelos disponibles` };
      }
      case "openai": {
        const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
        const r = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${v.api_key}` }, signal: tiempo(), cache: "no-store" });
        if (r.status === 401 || r.status === 403) return { ok: false, detalle: "La llave de OpenAI no es válida." };
        if (!r.ok) return { ok: false, detalle: `OpenAI respondió ${r.status}.` };
        const ids = (((await json(r)).data as { id: string }[]) ?? []).map((m) => m.id);
        if (v.modelo && !ids.includes(v.modelo)) return { ok: false, detalle: `Llave válida, pero el modelo «${v.modelo}» no está disponible para ella.` };
        return { ok: true, detalle: `Llave válida · ${ids.length} modelos disponibles` };
      }
    }
  } catch (e) {
    return { ok: false, detalle: `No se pudo conectar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ───────────────────────────── WhatsApp ─────────────────────────────

/** Firma de Meta en los webhooks: `X-Hub-Signature-256: sha256=<HMAC-SHA256(app_secret, cuerpo)>`. */
export function firmaWhatsappValida(cuerpo: string, firma: string | null, appSecret: string): boolean {
  if (!firma?.startsWith("sha256=") || !appSecret) return false;
  const esperado = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(cuerpo).digest("hex")}`);
  const recibido = Buffer.from(firma);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

/** Envía una plantilla aprobada. `numero` en formato internacional sin «+» (p. ej. 573001234567). */
export async function enviarPlantillaWhatsapp(numero: string, plantilla: string, idioma = "es", parametros: string[] = []): Promise<Resultado> {
  const w = await leerIntegracion("whatsapp");
  if (!w) return { ok: false, detalle: "WhatsApp no está conectado." };
  const destino = numero.replace(/\D/g, "");
  if (destino.length < 10 || destino.length > 15) return { ok: false, detalle: "Escribe el número con indicativo, por ejemplo 573001234567." };
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(w.valores.phone_number_id)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${w.valores.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "template",
        template: {
          name: plantilla,
          language: { code: idioma },
          ...(parametros.length && { components: [{ type: "body", parameters: parametros.map((t) => ({ type: "text", text: t })) }] }),
        },
      }),
      signal: tiempo(),
    });
    const d = await json(r);
    if (!r.ok) return { ok: false, detalle: (d.error as { message?: string })?.message ?? `Meta respondió ${r.status}.` };
    return { ok: true, detalle: "Mensaje enviado." };
  } catch (e) {
    return { ok: false, detalle: `No se pudo enviar: ${e instanceof Error ? e.message : String(e)}` };
  }
}
