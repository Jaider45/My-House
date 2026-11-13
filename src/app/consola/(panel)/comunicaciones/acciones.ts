"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";

/*
 * Campañas: el editor de bloques guarda, prueba y programa (editor-acciones.ts). Aquí queda cancelar una programada.
 */

const SIN_PERMISO = "Solo Contenido o un superadmin manejan campañas.";

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("campanas") ? staff : null;
}

export async function cancelarCampana(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Campaña no válida." };
  const { error } = await staff.supabase.rpc("consola_cancelar_campana", { p_id: id.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/comunicaciones");
  return { ok: "Campaña cancelada." };
}
