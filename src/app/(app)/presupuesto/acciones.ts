"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { digitosAMonto } from "@/lib/dinero";

const esquema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  items: z
    .array(z.object({ category_id: z.uuid(), monto: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }))
    .max(500)
    // Una categoría repetida se queda con el último valor.
    .transform((items) => [...new Map(items.map((i) => [i.category_id, i])).values()]),
});

/**
 * Guarda el gasto variable mensual de cada categoría (campos `adicional:<categoria>`); 0 borra el presupuesto.
 * El formulario manda solo las categorías que cambiaron. Todo en una llamada (`guardar_presupuesto`): o se guarda
 * todo o nada.
 */
export async function guardarPresupuesto(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const r = esquema.safeParse({
    mes: datos.get("mes") || undefined,
    items: [...datos.entries()]
      .filter(([k]) => k.startsWith("adicional:"))
      .map(([k, v]) => ({ category_id: k.slice("adicional:".length), monto: digitosAMonto(String(v)) })),
  });
  if (!r.success) return { error: "Datos de presupuesto inválidos. Recarga la página e intenta de nuevo." };

  if (r.data.items.length) {
    const { error } = await ctx.supabase.rpc("guardar_presupuesto", { p_hogar: ctx.hogar.id, p_items: r.data.items });
    if (error) return { error: mensajeError(error) };
  }
  revalidatePath("/presupuesto");
  revalidatePath("/");
  redirect(`/presupuesto${r.data.mes ? `?mes=${r.data.mes}` : ""}`);
}
