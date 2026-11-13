import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Ajustes de la plataforma (`plataforma_config`, lectura pública). Caché de 60 s por instancia, como las
 * integraciones: el correo, los cobros y los límites lo leen en cada uso sin ir siempre a la base.
 */
const cache = new Map<string, { valor: unknown; hasta: number }>();
const TTL = 60_000;

export type Envios = { remitente: string; responder_a: string; wa_desde: string; wa_hasta: string; wa_sin_marketing_domingo: boolean };
export type LimitesApp = { comprobante_mb: number; exigir_2fa_admins: boolean; intentos_bloqueo: number };
export type AvisoEquipo = { roles: string[]; activo: boolean };
export type Factura = { proveedor: string; resolucion: string; prefijo: string; desde: number | null; hasta: number | null; enviar_correo: boolean };

export async function leerConfigPlataforma<T>(clave: string, porDefecto: T): Promise<T> {
  const c = cache.get(clave);
  if (c && c.hasta > Date.now()) return c.valor as T;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !llave) return porDefecto;
  try {
    const db = createClient(url, llave, { auth: { persistSession: false } });
    const { data } = await db.from("plataforma_config").select("valor").eq("clave", clave).maybeSingle();
    const valor = (data?.valor ?? porDefecto) as T;
    const final = typeof porDefecto === "object" && porDefecto && !Array.isArray(porDefecto) ? ({ ...porDefecto, ...(valor as object) } as T) : valor;
    cache.set(clave, { valor: final, hasta: Date.now() + TTL });
    return final;
  } catch {
    return porDefecto;
  }
}

/** Tras guardar en la consola: la próxima lectura va a la base. */
export function olvidarConfig(clave?: string) {
  if (clave) cache.delete(clave);
  else cache.clear();
}

export const limitesApp = () => leerConfigPlataforma<LimitesApp>("limites_app", { comprobante_mb: 10, exigir_2fa_admins: false, intentos_bloqueo: 5 });
export const envios = () =>
  leerConfigPlataforma<Envios>("envios", { remitente: "", responder_a: "", wa_desde: "07:00", wa_hasta: "20:00", wa_sin_marketing_domingo: true });
