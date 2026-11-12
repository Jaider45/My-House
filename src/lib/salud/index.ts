import "server-only";
import { leerIntegracion, probar, type Valores } from "@/lib/integraciones/servidor";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";

/*
 * Chequeos de salud para la página de estado (Better Stack). Un monitor por componente consulta
 * `/api/salud/<componente>`: 200 = operativo, 503 = falla. La respuesta no trae detalles (es pública); el motivo
 * queda en el log del servidor. Cada resultado se guarda 60 s por instancia: los monitores (cada 3 min) y quien abra
 * la URL no multiplican las llamadas a Supabase, Resend, Wompi o los proveedores de IA.
 */

export const COMPONENTES = ["app", "base", "auth", "archivos", "correo", "pagos", "ia"] as const;
export type Componente = (typeof COMPONENTES)[number];

export type Chequeo = { ok: boolean; motivo?: string };

const TTL = 60_000;
const LIMITE_MS = 8_000;
const cache = new Map<Componente, { hasta: number; promesa: Promise<Chequeo> }>();

export const esComponente = (c: string): c is Componente => (COMPONENTES as readonly string[]).includes(c);

/** Resultado de un componente (cacheado 60 s; chequeos simultáneos comparten la misma promesa). */
export function chequear(c: Componente): Promise<Chequeo> {
  const guardado = cache.get(c);
  if (guardado && guardado.hasta > Date.now()) return guardado.promesa;
  const promesa = conLimite(CHEQUEOS[c]()).catch((e: unknown) => ({ ok: false, motivo: e instanceof Error ? e.message : String(e) }));
  cache.set(c, { hasta: Date.now() + TTL, promesa });
  return promesa;
}

function conLimite(p: Promise<Chequeo>): Promise<Chequeo> {
  return Promise.race([p, new Promise<Chequeo>((r) => setTimeout(() => r({ ok: false, motivo: `sin respuesta en ${LIMITE_MS / 1000} s` }), LIMITE_MS))]);
}

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const tiempo = () => AbortSignal.timeout(LIMITE_MS);

/** Resend: las llaves «Sending access» no leen nada y responden `restricted_api_key` (401), prueba de que la llave
 * existe y la API responde. Así se verifica sin enviar un correo. */
export function resendResponde(status: number, cuerpo: { name?: string }): boolean {
  return status < 300 || (status === 401 && cuerpo.name === "restricted_api_key");
}

async function integracion(p: "resend" | "wompi" | "anthropic" | "openai"): Promise<Valores | null> {
  return (await leerIntegracion(p))?.valores ?? null;
}

const CHEQUEOS: Record<Componente, () => Promise<Chequeo>> = {
  // La función responde (Vercel arriba). La portada la vigila Better Stack aparte.
  app: async () => ({ ok: true }),

  base: async () => {
    if (!hayServicio()) return { ok: false, motivo: "sin llave service_role" };
    const { error } = await crearClienteServicio().from("planes").select("*", { head: true, count: "exact" }).limit(1);
    return error ? { ok: false, motivo: error.message } : { ok: true };
  },

  auth: async () => {
    const url = supabaseUrl();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return { ok: false, motivo: "sin URL o llave de Supabase" };
    const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon }, signal: tiempo(), cache: "no-store" });
    return r.ok ? { ok: true } : { ok: false, motivo: `Auth respondió ${r.status}` };
  },

  archivos: async () => {
    if (!hayServicio()) return { ok: false, motivo: "sin llave service_role" };
    const { error } = await crearClienteServicio().storage.getBucket("soportes");
    return error ? { ok: false, motivo: error.message } : { ok: true };
  },

  correo: async () => {
    const v = await integracion("resend");
    if (!v) return { ok: false, motivo: "Resend no está conectado" };
    const r = await fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${v.api_key}` }, signal: tiempo(), cache: "no-store" });
    const cuerpo = (await r.json().catch(() => ({}))) as { name?: string };
    return resendResponde(r.status, cuerpo) ? { ok: true } : { ok: false, motivo: `Resend respondió ${r.status} ${cuerpo.name ?? ""}`.trim() };
  },

  pagos: async () => {
    const v = await integracion("wompi");
    if (!v) return { ok: false, motivo: "Wompi no está conectado" };
    const r = await probar("wompi", v);
    return r.ok ? { ok: true } : { ok: false, motivo: r.detalle };
  },

  // Operativa si al menos un proveedor conectado responde (la app usa el que tenga llave).
  ia: async () => {
    const conectados = (await Promise.all((["anthropic", "openai"] as const).map(async (p) => [p, await integracion(p)] as const))).filter(([, v]) => v);
    if (conectados.length === 0) return { ok: false, motivo: "ningún proveedor de IA conectado" };
    const resultados = await Promise.all(conectados.map(([p, v]) => probar(p, v!).then((r) => ({ p, ...r }))));
    return resultados.some((r) => r.ok) ? { ok: true } : { ok: false, motivo: resultados.map((r) => `${r.p}: ${r.detalle}`).join(" · ") };
  },
};
