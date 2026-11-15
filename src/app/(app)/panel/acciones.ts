"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuario } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { normalizarPanel } from "@/lib/panel";

/**
 * Guarda el Inicio de la persona (`user_metadata.panel`): preferencia propia, no dato del hogar, así que no pide rol
 * (el contador también arma el suyo). Se refresca la sesión para que el JWT traiga el panel nuevo.
 */
export async function guardarPanel(_: Estado, datos: FormData): Promise<Estado> {
  let entrada: unknown;
  try {
    entrada = JSON.parse(String(datos.get("panel") ?? ""));
  } catch {
    return { error: "No pude leer tu selección." };
  }
  const panel = normalizarPanel((entrada ?? {}) as Record<string, unknown>);
  if (!panel) return { error: "Elige al menos un indicador o una sección." };
  const { supabase } = await obtenerUsuario();
  const { error } = await supabase.auth.updateUser({ data: { panel } });
  if (error) return { error: mensajeError(error) };
  await supabase.auth.refreshSession();
  revalidatePath("/");
  return { ok: "Tu Inicio quedó guardado." };
}
