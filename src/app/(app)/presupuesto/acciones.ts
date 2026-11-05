"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerContexto } from "@/lib/sesion";
import { digitosAMonto } from "@/lib/dinero";

/** Guarda el adicional mensual de cada categoría (campos `adicional:<categoria>`); 0 borra el presupuesto. */
export async function guardarPresupuesto(datos: FormData) {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return;
  const valores = [...datos.entries()]
    .filter(([k]) => k.startsWith("adicional:"))
    .map(([k, v]) => ({ category_id: k.slice("adicional:".length), monto: digitosAMonto(String(v)) }));

  const conMonto = valores.filter((v) => v.monto > 0);
  const sinMonto = valores.filter((v) => v.monto === 0).map((v) => v.category_id);
  if (sinMonto.length) await ctx.supabase.from("budgets_goals").delete().eq("tipo", "presupuesto").in("category_id", sinMonto);
  for (const v of conMonto) {
    const { data } = await ctx.supabase.from("budgets_goals").update({ monto: v.monto }).eq("tipo", "presupuesto").eq("category_id", v.category_id).select("id");
    if (!data?.length) {
      await ctx.supabase.from("budgets_goals").insert({ household_id: ctx.hogar.id, tipo: "presupuesto", periodo: "mensual", category_id: v.category_id, monto: v.monto });
    }
  }
  revalidatePath("/presupuesto");
  redirect(`/presupuesto${datos.get("mes") ? `?mes=${datos.get("mes")}` : ""}`);
}
