"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuario } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { guiaPorId, leerVistas } from "@/lib/guias";

/**
 * Marca una guía como hecha en `user_metadata.guias` (preferencia de la persona, no dato del hogar: no pide rol).
 * Se refresca la sesión para que el JWT nuevo la traiga y no se vuelva a ofrecer la bienvenida.
 */
export async function marcarGuiaVista(id: string): Promise<Estado> {
  const guia = guiaPorId(id);
  if (!guia) return { error: "Guía no válida." };
  const { supabase } = await obtenerUsuario();
  const { data } = await supabase.auth.getUser(); // el JWT puede ir atrás de lo guardado
  const vistas = leerVistas(data.user?.user_metadata);
  if (vistas.includes(guia.id)) return { ok: "Listo." };
  const { error } = await supabase.auth.updateUser({ data: { guias: [...vistas, guia.id] } });
  if (error) return { error: mensajeError(error) };
  await supabase.auth.refreshSession();
  revalidatePath("/academia");
  return { ok: "Listo." };
}
