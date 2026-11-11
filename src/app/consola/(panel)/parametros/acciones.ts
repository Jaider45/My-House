"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { leerCalendario } from "@/lib/consola/calendario";

const SIN_PERMISO = "Solo Contenido o un superadmin editan los parámetros DIAN.";
const anio = z.coerce.number().int().min(2020).max(2100);

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("parametros") ? staff : null;
}

/** Campos `tope_<clave>` / `ded_<clave>` del formulario → objeto de números (en UVT o %). */
function numeros(datos: FormData, prefijo: string): Record<string, number> | string {
  const out: Record<string, number> = {};
  for (const [k, v] of datos.entries()) {
    if (!k.startsWith(prefijo)) continue;
    const texto = String(v).trim().replace(",", ".");
    if (texto === "") continue;
    const n = Number(texto);
    if (!Number.isFinite(n) || n < 0) return `«${k.slice(prefijo.length)}» debe ser un número.`;
    out[k.slice(prefijo.length)] = n;
  }
  return out;
}

export async function guardarParametros(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({ anio, uvt: z.coerce.number().int("La UVT va en pesos enteros.").min(10_000, "La UVT no parece correcta.").max(10_000_000), fuente: z.string().trim().max(200) })
    .safeParse({ anio: datos.get("anio"), uvt: String(datos.get("uvt") ?? "").replace(/\D/g, ""), fuente: datos.get("fuente") ?? "" });
  if (!r.success) return { error: r.error.issues[0].message };
  const topes = numeros(datos, "tope_");
  const deducciones = numeros(datos, "ded_");
  if (typeof topes === "string") return { error: topes };
  if (typeof deducciones === "string") return { error: deducciones };
  const { error } = await staff.supabase.rpc("consola_guardar_parametros", {
    p_pais: "CO",
    p_anio: r.data.anio,
    p_uvt: r.data.uvt,
    p_topes: topes,
    p_deducciones: deducciones,
    p_fuente: r.data.fuente,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/parametros");
  return { ok: `Borrador de ${r.data.anio} guardado. Publícalo para que rija en los hogares.` };
}

export async function publicarParametros(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const a = anio.safeParse(datos.get("anio"));
  if (!a.success) return { error: "Año no válido." };
  const accion = datos.get("accion") === "descartar" ? "consola_descartar_parametros" : "consola_publicar_parametros";
  const { error } = await staff.supabase.rpc(accion, { p_pais: "CO", p_anio: a.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/parametros");
  revalidatePath("/impuestos");
  return { ok: accion === "consola_publicar_parametros" ? `Parámetros de ${a.data} publicados.` : "Borrador descartado." };
}

export async function guardarCalendario(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const a = anio.safeParse(datos.get("anio"));
  if (!a.success) return { error: "Elige el año gravable." };
  const r = leerCalendario(String(datos.get("calendario") ?? ""), a.data);
  if ("error" in r) return { error: r.error };
  const { error } = await staff.supabase.rpc("consola_guardar_calendario", { p_pais: "CO", p_anio: a.data, p_fechas: r.fechas });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/parametros");
  return { ok: `Calendario del año gravable ${a.data} guardado: los hogares ya ven su fecha y reciben los avisos.` };
}

export async function guardarEtiqueta(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({
      codigo: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "El código va en minúsculas y sin espacios (ej.: intereses_vivienda)."),
      nombre: z.string().trim().min(2, "Escribe el nombre.").max(80),
      renglon: z.string().trim().max(20),
    })
    .safeParse({ codigo: datos.get("codigo"), nombre: datos.get("nombre"), renglon: datos.get("renglon") ?? "" });
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_guardar_etiqueta", { p_pais: "CO", p_codigo: r.data.codigo, p_nombre: r.data.nombre, p_renglon: r.data.renglon });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/parametros");
  return { ok: "Etiqueta guardada." };
}
