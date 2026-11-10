"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { LIMITES, type Limites } from "@/lib/planes";

const SIN_PERMISO = "Solo Finanzas o un superadmin editan planes, precios y cupones.";
const pesos = z.coerce.number().int("Usa pesos enteros.").min(0, "No puede ser negativo.").max(100_000_000);

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("planes") ? staff : null;
}

/** Límites del formulario: número vacío = sin límite (null); casilla = sí/no. Conserva claves que no se editan. */
function leerLimites(datos: FormData, previos: Limites): Limites | string {
  const out: Record<string, unknown> = { ...previos };
  for (const l of LIMITES) {
    const campo = `lim_${l.clave}`;
    if (!datos.has(campo) && !datos.has(`${campo}_presente`)) continue;
    if (l.tipo === "si_no") {
      out[l.clave] = datos.get(campo) === "on";
    } else {
      const v = String(datos.get(campo) ?? "").trim();
      if (v === "") out[l.clave] = null;
      else if (!/^\d{1,7}$/.test(v)) return `${l.texto}: escribe un número entero o déjalo vacío para «sin límite».`;
      else out[l.clave] = Number(v);
    }
  }
  return out as Limites;
}

export async function guardarPlan(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({ codigo: z.string().regex(/^[a-z][a-z_]{1,30}$/), nombre: z.string().trim().min(1, "Escribe el nombre.").max(40), mensual: pesos, anual: pesos })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  let previos: Limites = {};
  try {
    previos = JSON.parse(String(datos.get("limites_previos") ?? "{}"));
  } catch {
    return { error: "Recarga la página e intenta de nuevo." };
  }
  const limites = leerLimites(datos, previos);
  if (typeof limites === "string") return { error: limites };
  const { error } = await staff.supabase.rpc("consola_guardar_plan", {
    p_codigo: r.data.codigo,
    p_nombre: r.data.nombre,
    p_mensual: r.data.mensual,
    p_anual: r.data.anual,
    p_limites: limites as never,
    p_publicado: datos.get("publicado") === "on",
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/planes");
  revalidatePath("/ajustes/plan");
  return { ok: `Plan ${r.data.nombre} publicado.` };
}

export async function guardarReglas(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const dias = z.coerce.number().int().min(0).max(60).safeParse(datos.get("prueba_dias"));
  if (!dias.success) return { error: "La prueba dura entre 0 y 60 días." };
  for (const [clave, valor] of [
    ["prueba_dias", dias.data],
    ["descuento_anual_visible", datos.get("descuento_anual_visible") === "on"],
    ["iva_incluido", datos.get("iva_incluido") === "on"],
  ] as const) {
    const { error } = await staff.supabase.rpc("consola_guardar_config", { p_clave: clave, p_valor: valor });
    if (error) return { error: mensajeError(error) };
  }
  revalidatePath("/consola/planes");
  return { ok: "Reglas guardadas." };
}

export async function guardarCupon(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const vacioNulo = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : v);
  const r = z
    .object({
      codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "El código lleva de 3 a 30 letras, números, guion o guion bajo."),
      descripcion: z.string().trim().max(120),
      tipo: z.enum(["porcentaje", "meses_gratis"]),
      valor: z.coerce.number().int().min(1, "El valor debe ser mayor que 0.").max(100),
      periodos: z.coerce.number().int().min(1).max(120).nullable(),
      periodo: z.enum(["mensual", "anual"]).nullable(),
      usos_max: z.coerce.number().int().min(1).max(1_000_000).nullable(),
      hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    })
    .safeParse({
      codigo: datos.get("codigo"),
      descripcion: datos.get("descripcion") ?? "",
      tipo: datos.get("tipo"),
      valor: datos.get("valor"),
      periodos: vacioNulo(datos.get("periodos")),
      periodo: vacioNulo(datos.get("periodo")),
      usos_max: vacioNulo(datos.get("usos_max")),
      hasta: vacioNulo(datos.get("hasta")),
    });
  if (!r.success) return { error: r.error.issues[0].message };
  const planes = datos.getAll("planes").map(String);
  if (!planes.length) return { error: "Elige al menos un plan." };
  const { error } = await staff.supabase.rpc("consola_guardar_cupon", {
    p_codigo: r.data.codigo,
    p_descripcion: r.data.descripcion,
    p_tipo: r.data.tipo,
    p_valor: r.data.valor,
    p_periodos: (r.data.tipo === "porcentaje" ? r.data.periodos : null) as number,
    p_planes: planes,
    p_periodo: r.data.periodo as string,
    p_usos_max: r.data.usos_max as number,
    p_desde: null as unknown as string,
    p_hasta: (r.data.hasta ? `${r.data.hasta}T23:59:59-05:00` : null) as string,
    p_activo: datos.get("activo") === "on",
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/planes");
  return { ok: `Cupón ${r.data.codigo} guardado.` };
}
