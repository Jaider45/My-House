"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { obtenerUsuario } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { claveLeccion, leccionDe, leerVistasAcademia } from "@/lib/academia";

/**
 * Marca una lección como vista (preferencia de la persona en `user_metadata.academia`, como las guías) y sigue con
 * la siguiente del curso o vuelve a la Academia si era la última.
 */
export async function marcarLeccion(_: Estado, datos: FormData): Promise<Estado> {
  const l = leccionDe(String(datos.get("curso") ?? ""), String(datos.get("leccion") ?? ""));
  if (!l) return { error: "Lección no válida." };
  const { supabase } = await obtenerUsuario();
  const { data } = await supabase.auth.getUser(); // el JWT puede ir atrás de lo guardado
  const vistas = leerVistasAcademia(data.user?.user_metadata);
  const clave = claveLeccion(l.curso.slug, l.leccion.slug);
  if (!vistas.includes(clave)) {
    const { error } = await supabase.auth.updateUser({ data: { academia: [...vistas, clave] } });
    if (error) return { error: mensajeError(error) };
    await supabase.auth.refreshSession();
  }
  revalidatePath("/academia", "layout");
  redirect(l.siguiente ? `/academia/${l.curso.slug}/${l.siguiente.slug}` : `/academia?terminado=${l.curso.slug}`);
}
