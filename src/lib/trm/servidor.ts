import "server-only";
import type { Servicio } from "@/lib/supabase/servicio";
import { leerTrm } from ".";
import { leerConfigHogar } from "@/lib/hogar";

const FUENTE = "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1";

/** Trae la TRM vigente de datos.gov.co y la guarda (service_role). Nunca lanza: devuelve lo guardado o null. */
export async function actualizarTrm(db: Servicio): Promise<{ fecha: string; valor: number } | null> {
  try {
    const r = await fetch(FUENTE, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const trm = leerTrm(await r.json());
    if (!trm) return null;
    const { error } = await db.from("trm").upsert({ fecha: trm.fecha, valor: trm.valor, fuente: "datos.gov.co" });
    if (error) console.error("[trm]", error.message);
    return trm;
  } catch {
    return null;
  }
}

/**
 * TRM con la que el hogar convierte dólares: la oficial más reciente si «Actualizar TRM a diario» está activo (o si
 * no hay manual), o la que escribió el hogar. null si no hay ninguna.
 */
export async function trmDelHogar(ctx: { supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").crearClienteServidor>>; hogar: { id: string } }): Promise<{ valor: number; fecha: string | null; auto: boolean } | null> {
  const [{ data: ultima }, { data: hogar }] = await Promise.all([
    ctx.supabase.from("trm").select("fecha, valor").order("fecha", { ascending: false }).limit(1).maybeSingle(),
    ctx.supabase.from("households").select("config").eq("id", ctx.hogar.id).single(),
  ]);
  const { trm } = leerConfigHogar(hogar?.config);
  if (!trm.auto && trm.manual) return { valor: trm.manual, fecha: null, auto: false };
  if (ultima) return { valor: Number(ultima.valor), fecha: ultima.fecha, auto: true };
  return trm.manual ? { valor: trm.manual, fecha: null, auto: false } : null;
}
