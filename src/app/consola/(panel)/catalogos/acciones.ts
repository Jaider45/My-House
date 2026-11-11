"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { idDe, mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { normalizarDescripcion, type Mapeo } from "@/lib/importacion";

const SIN_PERMISO = "Solo Contenido o un superadmin editan los catálogos.";

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("parametros") ? staff : null;
}

const opcional = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

export async function guardarCategoriaBase(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({
      nombre: z.string().trim().min(1, "Escribe el nombre.").max(60),
      clase: z.enum(["gasto", "ingreso"]),
      tipo: z.enum(["fijo", "variable"]),
      orden: z.coerce.number().int().min(0).max(999),
    })
    .safeParse({ nombre: datos.get("nombre"), clase: datos.get("clase"), tipo: datos.get("tipo"), orden: datos.get("orden") || 100 });
  if (!r.success) return { error: r.error.issues[0].message };
  const padre = opcional(datos.get("padre"));
  if (padre && !z.uuid().safeParse(padre).success) return { error: "Categoría madre no válida." };
  const { error } = await staff.supabase.rpc("consola_guardar_categoria_base", {
    p_id: idDe(datos) as string,
    p_nombre: r.data.nombre,
    p_padre: padre as string,
    p_clase: r.data.clase,
    p_tipo: r.data.tipo,
    p_esencial: datos.get("esencial") === "on",
    p_excluir: datos.get("excluir") === "on",
    p_etiqueta: opcional(datos.get("etiqueta")) as string,
    p_orden: r.data.orden,
    p_activa: datos.get("activa") === "on",
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/catalogos");
  return { ok: "Categoría guardada: la reciben los hogares nuevos." };
}

/** Patrón como lo comparan las reglas: minúsculas, sin tildes ni signos. */
const patron = (texto: FormDataEntryValue | null) => normalizarDescripcion(String(texto ?? "")).slice(0, 80);

export async function guardarReglaGlobal(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const p = patron(datos.get("patron"));
  const categoria = String(datos.get("categoria") ?? "").trim();
  if (p.length < 2) return { error: "Escribe el patrón del comercio (ej.: rappi, exito)." };
  if (!categoria) return { error: "Elige la categoría." };
  const ambito = datos.get("ambito");
  const { error } = await staff.supabase.rpc("consola_guardar_regla_global", {
    p_id: idDe(datos) as string,
    p_patron: p,
    p_categoria: categoria,
    p_ambito: (ambito === "personal" || ambito === "negocio" ? ambito : null) as "personal",
    p_activa: datos.has("activa") ? datos.get("activa") === "1" : true,
    p_origen: datos.get("origen") === "aprendida" ? "aprendida" : "manual",
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/catalogos");
  return { ok: `Regla «${p}» guardada.` };
}

/** Líneas «patrón; categoría» (también con coma o tabulador, como sale de una hoja de cálculo). */
export async function importarReglas(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const lineas = String(datos.get("reglas") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lineas.length) return { error: "Pega una regla por línea: «patrón; categoría»." };
  const filas: { patron: string; categoria: string }[] = [];
  for (const [i, l] of lineas.entries()) {
    const [a, b] = l.split(/[;\t,]/);
    const p = patron(a ?? "");
    if (p.length < 2 || !b?.trim()) return { error: `Línea ${i + 1}: escribe «patrón; categoría».` };
    filas.push({ patron: p, categoria: b.trim().slice(0, 60) });
  }
  const { data, error } = await staff.supabase.rpc("consola_importar_reglas", { p_filas: filas });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/catalogos");
  return { ok: `${data} ${data === 1 ? "regla importada" : "reglas importadas"}.` };
}

export async function guardarFormato(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const banco = String(datos.get("banco") ?? "").trim();
  const encabezados = String(datos.get("encabezados") ?? "")
    .split(/[;\t,]/)
    .map((e) => e.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  if (banco.length < 2) return { error: "Escribe el nombre del banco o del formato." };
  if (encabezados.length < 2) return { error: "Pega la fila de encabezados del extracto (separados por coma o punto y coma)." };
  const col = (campo: string) => {
    const v = String(datos.get(campo) ?? "").trim();
    return encabezados.find((e) => normalizarDescripcion(e) === normalizarDescripcion(v));
  };
  const modo = datos.get("modo") === "separado" ? "separado" : "unico";
  const mapeo: Mapeo = {
    fecha: col("fecha") ?? "",
    descripcion: col("descripcion") ?? "",
    modo,
    ...(modo === "unico" ? { monto: col("monto") } : { debito: col("debito"), credito: col("credito") }),
    gastosNegativos: datos.get("gastosNegativos") === "on",
  };
  const falta = !mapeo.fecha ? "fecha" : !mapeo.descripcion ? "descripción" : modo === "unico" ? (!mapeo.monto ? "valor" : null) : !mapeo.debito ? "débito" : !mapeo.credito ? "crédito" : null;
  if (falta) return { error: `La columna de ${falta} debe ser uno de los encabezados.` };
  const { error } = await staff.supabase.rpc("consola_guardar_formato", {
    p_id: idDe(datos) as string,
    p_banco: banco,
    p_encabezados: encabezados,
    p_mapeo: mapeo,
    p_activo: datos.has("activo_presente") ? datos.get("activo") === "on" : true,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/catalogos");
  return { ok: `Formato «${banco}» guardado: el importador lo reconoce desde ya.` };
}
