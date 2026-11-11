import "server-only";
import { cache } from "react";
import { obtenerContexto } from "@/lib/sesion";

/**
 * Hogares de la persona (uno por request): los usan el selector y la navegación. Con `cache` de React la consulta
 * se hace una sola vez aunque la llamen dos componentes del mismo layout.
 */
export const misHogares = cache(async () => {
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase.rpc("mis_hogares_lista");
  return data ?? [];
});
