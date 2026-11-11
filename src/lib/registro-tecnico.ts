import "server-only";
import type { obtenerContexto } from "@/lib/sesion";

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

/**
 * Anota un error técnico del hogar (importación, IA, correo) para que soporte entienda qué pasó cuando le escriban.
 * Sin montos ni datos del movimiento: solo el mensaje y detalles técnicos. Nunca rompe a quien lo llama.
 */
export async function registrarError(ctx: Ctx, tipo: "importacion" | "ia" | "correo" | "otro", mensaje: string, detalle: Record<string, string | number | boolean | null> = {}) {
  try {
    await ctx.supabase.rpc("registrar_error", { p_hogar: ctx.hogar.id, p_tipo: tipo, p_mensaje: mensaje.slice(0, 500), p_detalle: detalle });
  } catch {
    // el registro técnico es ayuda, no requisito
  }
}
