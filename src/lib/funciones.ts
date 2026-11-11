import "server-only";
import { cache } from "react";
import { obtenerContexto } from "@/lib/sesion";

/**
 * Feature flags (consola → Sistema): funciones encendidas para quien está en su hogar activo, por plan, porcentaje
 * estable de hogares o solo el equipo. Una consulta por request (`cache`). Uso en una página o acción de servidor:
 *
 *   if (await funcionActiva("pronostico_gastos")) { … }
 *
 * La clave se crea en la consola; mientras no exista o esté apagada, devuelve false (lo nuevo nace apagado).
 */
export const misFunciones = cache(async (): Promise<ReadonlySet<string>> => {
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase.rpc("mis_funciones");
  return new Set(data ?? []);
});

export async function funcionActiva(clave: string): Promise<boolean> {
  return (await misFunciones()).has(clave);
}
