"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { problemasLeccion, textoABloques, type Extras } from "@/lib/academia/texto";

const SIN_PERMISO = "Solo el rol Contenido o un superadmin editan la Academia.";
const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const slug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("contenido_app") ? staff : null;
}
const refrescar = () => {
  revalidatePath("/consola/academia");
  revalidatePath("/academia", "layout");
};

export async function guardarRuta(_: Estado, d: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const titulo = t(d, "titulo");
  const s = slug(t(d, "slug") || titulo);
  if (titulo.length < 3 || !/^[a-z][a-z0-9-]{1,40}$/.test(s)) return { error: "Escribe el título (y una dirección corta que empiece por letra)." };
  const { error } = await staff.supabase.rpc("consola_guardar_ruta", {
    p: { slug_previo: t(d, "slug_previo"), slug: s, titulo, portada: t(d, "portada"), descripcion: t(d, "descripcion"), tema: t(d, "tema"), icono: t(d, "icono"), color: t(d, "color"), publicada: d.get("publicada") === "1" } as never,
  });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Ruta guardada." };
}

function leerExtras(d: FormData): Extras {
  const f = new Set(d.getAll("formato").map(String));
  const opciones = t(d, "quiz_opciones")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return {
    video: f.has("video") && t(d, "video_url") ? { url: t(d, "video_url"), duracion: t(d, "video_duracion") } : null,
    plantilla: f.has("plantilla") && t(d, "plantilla_url") ? { titulo: t(d, "plantilla_titulo") || "Plantilla", url: t(d, "plantilla_url") } : null,
    aplica: t(d, "aplica_href") && t(d, "aplica_boton") ? { titulo: t(d, "aplica_titulo") || "Aplícalo en My House", texto: t(d, "aplica_texto"), href: t(d, "aplica_href"), boton: t(d, "aplica_boton") } : null,
    guia: t(d, "guia_id") ? { id: t(d, "guia_id"), texto: t(d, "guia_texto") } : null,
    quiz: f.has("repaso") && t(d, "quiz_pregunta") ? { pregunta: t(d, "quiz_pregunta"), opciones, correcta: Number(t(d, "quiz_correcta")) || 0, bien: t(d, "quiz_bien"), mal: t(d, "quiz_mal") } : null,
  };
}

/** Guardar la lección como borrador o publicar (aplica el borrador). */
export async function accionLeccion(_: Estado, d: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = t(d, "id");
  const titulo = t(d, "titulo");
  const minutos = Number(t(d, "minutos"));
  const bloques = textoABloques(String(d.get("contenido") ?? ""), leerExtras(d));
  const publicar = d.get("operacion") === "publicar";
  if (publicar) {
    const p = problemasLeccion(titulo, minutos, bloques);
    if (p.length) return { error: p[0] };
  }
  const ruta = t(d, "ruta");
  const s = slug(titulo);
  const { data, error } = await staff.supabase.rpc("consola_guardar_leccion", { p: { id, ruta, slug: s, titulo, minutos: Math.min(60, Math.max(1, minutos || 3)), bloques } as never });
  if (error) return { error: mensajeError(error) };
  if (publicar) {
    const r = await staff.supabase.rpc("consola_publicar_leccion", { p_id: data as string, p_publicar: true });
    if (r.error) return { error: mensajeError(r.error) };
  }
  refrescar();
  if (!id) redirect(`/consola/academia?ruta=${ruta}&leccion=${data}`);
  return { ok: publicar ? "Publicada: ya la ven en la app." : "Borrador guardado (la app sigue mostrando la versión publicada)." };
}

export async function despublicarLeccion(_: Estado, d: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const { error } = await staff.supabase.rpc("consola_publicar_leccion", { p_id: t(d, "id"), p_publicar: false });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Ya no aparece en la app." };
}

export async function ordenarLecciones(ruta: string, ids: string[]): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const { error } = await staff.supabase.rpc("consola_ordenar_lecciones", { p_ruta: ruta, p_ids: ids });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Orden guardado." };
}

export async function guardarRecomendacion(_: Estado, d: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const [ruta, leccion = ""] = t(d, "destino").split("/");
  if (d.get("borrar") !== "1" && !ruta) return { error: "Elige qué recomendar." };
  const { error } = await staff.supabase.rpc("consola_guardar_recomendacion", {
    p: { id: t(d, "id"), borrar: d.get("borrar") === "1", condicion: t(d, "condicion"), ruta, leccion, lugares: d.getAll("lugares").map(String), activa: d.get("activa") !== "0" } as never,
  });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Regla guardada." };
}

export async function guardarTaller(_: Estado, d: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const fecha = t(d, "fecha");
  if (t(d, "titulo").length < 3 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha)) return { error: "Escribe el título y la fecha con hora." };
  const enlace = t(d, "enlace");
  if (enlace && !enlace.startsWith("https://")) return { error: "El enlace de la sesión empieza por https://." };
  const { error } = await staff.supabase.rpc("consola_guardar_taller", {
    p: { id: t(d, "id"), titulo: t(d, "titulo"), descripcion: t(d, "descripcion"), fecha: `${fecha}:00-05:00`, enlace, cupos: Number(t(d, "cupos")) || 100, publicado: d.get("publicado") === "1" } as never,
  });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Taller guardado." };
}
