"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { obtenerUsuario } from "@/lib/sesion";
import { cargarCursos } from "@/lib/academia/servidor";
import { mensajeError, type Estado } from "@/lib/acciones";
import { claveLeccion, leccionDe, leerVistasAcademia } from "@/lib/academia";

/**
 * Marca una lección como vista (preferencia de la persona en `user_metadata.academia`, como las guías) y sigue con
 * la siguiente del curso o vuelve a la Academia si era la última.
 */
export async function marcarLeccion(_: Estado, datos: FormData): Promise<Estado> {
  const { supabase } = await obtenerUsuario();
  const cursos = await cargarCursos(supabase);
  const l = leccionDe(cursos, String(datos.get("curso") ?? ""), String(datos.get("leccion") ?? ""));
  if (!l) return { error: "Lección no válida." };
  const { data } = await supabase.auth.getUser(); // el JWT puede ir atrás de lo guardado
  const vistas = leerVistasAcademia(data.user?.user_metadata, cursos);
  const clave = claveLeccion(l.curso.slug, l.leccion.slug);
  if (!vistas.includes(clave)) {
    const { error } = await supabase.auth.updateUser({ data: { academia: [...vistas, clave] } });
    if (error) return { error: mensajeError(error) };
    await supabase.auth.refreshSession();
  }
  // Para las métricas de la consola (personas que aprenden, finalización).
  await supabase.rpc("academia_vista", { p_clave: clave });
  revalidatePath("/academia", "layout");
  redirect(l.siguiente ? `/academia/${l.curso.slug}/${l.siguiente.slug}` : `/academia?terminado=${l.curso.slug}`);
}

/** «¿Te sirvió esta lección?»: de 1 a 5 estrellas (calificación de la Academia en la consola). */
export async function calificarLeccion(_: Estado, datos: FormData): Promise<Estado> {
  const estrellas = Number(datos.get("estrellas"));
  const clave = String(datos.get("clave") ?? "");
  if (!(estrellas >= 1 && estrellas <= 5) || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(clave)) return { error: "Calificación no válida." };
  const { supabase } = await obtenerUsuario();
  const { error } = await supabase.rpc("academia_calificar", { p_clave: clave, p_estrellas: estrellas });
  if (error) return { error: mensajeError(error) };
  return { ok: "¡Gracias! Nos ayuda a mejorar la Academia." };
}

/** Inscribirse (o salirse) de un taller en vivo; el enlace de la sesión aparece en la Academia. */
export async function inscribirTaller(_: Estado, datos: FormData): Promise<Estado> {
  const id = String(datos.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Taller no válido." };
  const { supabase } = await obtenerUsuario();
  const inscribir = datos.get("inscribir") === "1";
  const { error } = await supabase.rpc("inscribir_taller", { p_id: id, p_inscribir: inscribir });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/academia");
  return { ok: inscribir ? "¡Listo! Quedaste inscrito: el enlace está en la tarjeta del taller." : "Cancelaste tu inscripción." };
}
