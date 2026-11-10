"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerContexto } from "@/lib/sesion";

/** Crea (una vez) el código de referido de la firma. La base exige admin y plan Contador. */
export async function crearEnlaceReferido(_: Estado, datos: FormData): Promise<Estado> {
  const id = z.uuid().safeParse(datos.get("firma"));
  if (!id.success) return { error: "Firma no válida." };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.rpc("obtener_ref", { p_hogar: id.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/clientes");
  return { ok: "Enlace creado. Compártelo con tus clientes." };
}
