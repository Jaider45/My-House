"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";

const opcional = z.uuid().optional().or(z.literal("").transform(() => undefined));

const esquema = z.object({
  id: opcional,
  padre_id: opcional,
  nombre: z.string().trim().min(1, "Escriba el nombre.").max(60),
  clase: z.enum(["gasto", "ingreso"]),
  tipo: z.enum(["fijo", "variable"]),
  es_esencial: z.literal("on").optional(),
  excluir_de_costo_vida: z.literal("on").optional(),
});

export async function guardarCategoria(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Su rol es de solo lectura." };

  const { id, padre_id, nombre, clase, tipo } = r.data;
  const fila = {
    nombre,
    tipo,
    es_esencial: r.data.es_esencial === "on",
    excluir_de_costo_vida: r.data.excluir_de_costo_vida === "on",
  };
  const { error } = id
    ? await ctx.supabase.from("categories").update(fila).eq("id", id)
    : await ctx.supabase
        .from("categories")
        .insert({ ...fila, clase, padre_id: padre_id ?? null, household_id: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/categorias");
  return { ok: id ? "Guardado." : `«${nombre}» creada.` };
}

export async function archivarCategoria(datos: FormData) {
  const ctx = await obtenerContexto();
  await ctx.supabase
    .from("categories")
    .update({ archivada: datos.get("archivar") === "1" })
    .eq("id", String(datos.get("id")));
  revalidatePath("/categorias");
}

export async function eliminarCategoria(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.from("categories").delete().eq("id", String(datos.get("id")));
  if (error?.code === "23503") {
    return { error: "Tiene movimientos, reglas o subcategorías. Archívela en lugar de eliminarla." };
  }
  if (error) return { error: mensajeError(error) };
  revalidatePath("/categorias");
  return { ok: "Eliminada." };
}
