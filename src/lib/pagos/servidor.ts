import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { enviarCorreo } from "@/lib/correo/enviar";
import type { Contenido } from "@/lib/correo/plantilla";
import { apiWompi, type TransaccionWompi } from "./wompi";

/*
 * Piezas de servidor de los cobros. La llave service_role solo la usan el webhook de Wompi (/api/pagos/wompi) y el
 * cron de vencimientos (/api/cobros): confirman pagos y cambian planes, cosas que ningún usuario puede hacer.
 */

export type Servicio = SupabaseClient<Database>;

export function crearClienteServicio(): Servicio {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Compara `Authorization` con `Bearer <secreto>` en tiempo constante (Vercel Cron manda CRON_SECRET). */
export function cronAutorizado(encabezado: string | null, secreto: string | undefined): boolean {
  if (!secreto) return false;
  const a = createHash("sha256").update(encabezado ?? "").digest();
  const b = createHash("sha256").update(`Bearer ${secreto}`).digest();
  return timingSafeEqual(a, b);
}

/** Transacción según Wompi (endpoint público, sin llave privada). null si no existe o Wompi no responde. */
export async function consultarTransaccion(id: string, llavePublica: string): Promise<TransaccionWompi | null> {
  if (!/^[\w-]{6,80}$/.test(id)) return null;
  try {
    const r = await fetch(`${apiWompi(llavePublica)}/transactions/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return ((await r.json()) as { data?: TransaccionWompi }).data ?? null;
  } catch {
    return null;
  }
}

/** Administradores del hogar con su correo (para los avisos de cobro). */
export async function administradores(db: Servicio, hogar: string): Promise<{ nombre: string; email: string; hogar: string }[]> {
  const { data: miembros } = await db.from("members").select("nombre, user_id, households(nombre)").eq("household_id", hogar).eq("rol", "admin");
  const ids = (miembros ?? []).map((m) => m.user_id).filter((x): x is string => Boolean(x));
  if (!ids.length) return [];
  const { data: correos } = await db.rpc("correos_de_usuarios", { p_ids: ids });
  const porId = new Map((correos ?? []).map((c) => [c.id, c.email]));
  return (miembros ?? [])
    .filter((m) => m.user_id && porId.get(m.user_id))
    .map((m) => ({ nombre: m.nombre.split(/\s+/)[0], email: porId.get(m.user_id!)!, hogar: m.households?.nombre ?? "tu hogar" }));
}

/** Envía un correo a cada administrador. Devuelve cuántos salieron. Nunca lanza. */
export async function avisarAdministradores(
  db: Servicio,
  hogar: string,
  etiqueta: string,
  armar: (a: { nombre: string; hogar: string }) => Contenido,
): Promise<number> {
  let enviados = 0;
  for (const a of await administradores(db, hogar)) {
    const r = await enviarCorreo({ para: a.email, etiqueta, contenido: armar(a) });
    if (r.enviado) enviados++;
  }
  return enviados;
}
