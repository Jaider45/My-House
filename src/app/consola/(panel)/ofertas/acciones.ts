"use server";

import { revalidatePath } from "next/cache";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";

const SIN_PERMISO = "Solo el rol Contenido o un superadmin editan ofertas, enlaces y aliados.";
const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const fecha = (d: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t(d, k)) ? t(d, k) : null);
const url = (v: string) => (!v || v.startsWith("/") || v.startsWith("https://") ? v : `https://${v.replace(/^http:\/\//, "")}`);

async function guardar(fn: "consola_guardar_oferta" | "consola_guardar_enlace" | "consola_guardar_aliado", p: Record<string, unknown>, ok: string): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("contenido_app")) return { error: SIN_PERMISO };
  const { error } = await staff.supabase.rpc(fn, { p: p as never });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/ofertas");
  revalidatePath("/", "layout");
  return { ok };
}

export async function guardarOferta(_: Estado, d: FormData): Promise<Estado> {
  if (t(d, "titulo").length < 3) return { error: "Escribe el título." };
  if (t(d, "boton_url") && !t(d, "boton_texto")) return { error: "Escribe el texto del botón." };
  return guardar(
    "consola_guardar_oferta",
    {
      id: t(d, "id"),
      titulo: t(d, "titulo"),
      texto: t(d, "texto").slice(0, 240),
      etiqueta: t(d, "etiqueta"),
      boton_texto: t(d, "boton_texto"),
      boton_url: url(t(d, "boton_url")),
      lugar: t(d, "lugar"),
      audiencia: t(d, "audiencia"),
      desde: fecha(d, "desde"),
      hasta: fecha(d, "hasta"),
      publicada: d.get("publicada") === "1",
    },
    "Oferta guardada.",
  );
}

export async function guardarEnlace(_: Estado, d: FormData): Promise<Estado> {
  if (d.get("borrar") !== "1" && (t(d, "titulo").length < 3 || !t(d, "url"))) return { error: "Escribe el título y la dirección." };
  return guardar(
    "consola_guardar_enlace",
    {
      id: t(d, "id"),
      borrar: d.get("borrar") === "1",
      titulo: t(d, "titulo"),
      fuente: t(d, "fuente"),
      url: url(t(d, "url")),
      categoria: t(d, "categoria"),
      lugar: t(d, "lugar"),
      orden: Number(t(d, "orden")) || 100,
      activo: d.get("activo") !== "0",
    },
    d.get("borrar") === "1" ? "Enlace borrado." : "Enlace guardado.",
  );
}

export async function guardarAliado(_: Estado, d: FormData): Promise<Estado> {
  if (t(d, "nombre").length < 2) return { error: "Escribe el nombre del aliado." };
  return guardar(
    "consola_guardar_aliado",
    { id: t(d, "id"), nombre: t(d, "nombre"), tipo: t(d, "tipo"), beneficio: t(d, "beneficio"), cupon: t(d, "cupon"), url: t(d, "url") ? url(t(d, "url")) : "", estado: t(d, "estado"), notas: t(d, "notas") },
    "Aliado guardado.",
  );
}
