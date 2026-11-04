"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { movimientoDesdeFormulario } from "@/lib/ingesta";
import { formatearCOP } from "@/lib/dinero";
import { mesDe } from "@/lib/fechas";

function refrescar() {
  revalidatePath("/movimientos");
  revalidatePath("/");
  revalidatePath("/cuentas");
}

export async function guardarMovimiento(_: Estado, datos: FormData): Promise<Estado> {
  const r = movimientoDesdeFormulario(datos);
  if (!r.ok) return { error: r.error };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Su rol es de solo lectura." };

  const id = String(datos.get("id") ?? "");
  // Al editar se conserva el origen; guardar a mano un programado lo confirma.
  const m = r.movimiento;
  const cambios = {
    tipo: m.tipo,
    fecha: m.fecha,
    monto: m.monto,
    account_id: m.account_id,
    cuenta_destino_id: m.cuenta_destino_id,
    category_id: m.category_id,
    member_id: m.member_id,
    tax_tag_id: m.tax_tag_id,
    comercio: m.comercio,
    nota: m.nota,
    estado: "confirmado" as const,
  };
  const { error } = id
    ? await ctx.supabase.from("transactions").update(cambios).eq("id", id)
    : await ctx.supabase.from("transactions").insert({ ...r.movimiento, household_id: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };

  // Clasificar de una vez lo importado sin categoría del mismo comercio.
  if (id && datos.get("aplicar_similares") === "on" && m.comercio && m.category_id) {
    await ctx.supabase
      .from("transactions")
      .update({ category_id: m.category_id })
      .is("category_id", null)
      .eq("tipo", m.tipo)
      .eq("comercio", m.comercio);
  }
  refrescar();
  redirect(`/movimientos?mes=${mesDe(r.movimiento.fecha)}`);
}

/** Registro rápido: guarda y se queda en la pantalla para el siguiente. */
export async function registrarRapido(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Su rol es de solo lectura." };
  datos.set("member_id", ctx.miembro.id);
  const r = movimientoDesdeFormulario(datos);
  if (!r.ok) return { error: r.error };
  const { error } = await ctx.supabase.from("transactions").insert({ ...r.movimiento, household_id: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: `${r.movimiento.tipo === "ingreso" ? "Ingreso" : "Gasto"} de ${formatearCOP(r.movimiento.monto)} guardado.` };
}

export async function eliminarMovimiento(datos: FormData) {
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase
    .from("transactions")
    .delete()
    .eq("id", String(datos.get("id")))
    .select("fecha")
    .maybeSingle();
  refrescar();
  redirect(data ? `/movimientos?mes=${mesDe(data.fecha)}` : "/movimientos");
}

export async function confirmarMovimiento(datos: FormData) {
  const ctx = await obtenerContexto();
  await ctx.supabase.from("transactions").update({ estado: "confirmado" }).eq("id", String(datos.get("id")));
  refrescar();
}
