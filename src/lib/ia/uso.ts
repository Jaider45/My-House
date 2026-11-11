import "server-only";
import type { obtenerContexto } from "@/lib/sesion";
import type { UsoIa } from "./tipos";

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

/**
 * Anota modelo, tokens y tiempo de las lecturas ya reservadas (`reservar_uso_ia`) para el costo y el tope de gasto de
 * la consola → IA. Una por una: cada llamada anota la última reserva pendiente. Nunca rompe la acción que lo pide.
 */
export async function registrarUsos(ctx: Ctx, usos: UsoIa[], ms: number) {
  const porLectura = usos.length ? Math.round(ms / usos.length) : 0;
  for (const u of usos) {
    const { error } = await ctx.supabase.rpc("registrar_costo_ia", {
      p_hogar: ctx.hogar.id,
      p_modelo: u.modelo,
      p_entrada: Math.max(0, Math.round(u.entrada)),
      p_salida: Math.max(0, Math.round(u.salida)),
      p_ms: Math.min(3_600_000, Math.max(0, porLectura)),
    });
    if (error) console.warn(`[ia] no se anotó el uso: ${error.message}`);
  }
}
