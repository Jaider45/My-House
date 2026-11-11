"use server";

import { revalidatePath } from "next/cache";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { leerPrecios } from "@/lib/consola/precios-ia";

const SIN_PERMISO = "Solo Contenido o un superadmin cambian la configuración de la IA.";

export async function guardarConfigIa(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("parametros")) return { error: SIN_PERMISO };

  const umbral = Number(datos.get("umbral"));
  if (!Number.isInteger(umbral) || umbral < 50 || umbral > 100) return { error: "El umbral va de 50 a 100." };
  const textoTope = String(datos.get("tope") ?? "").trim().replace(",", ".");
  const tope = textoTope === "" ? null : Number(textoTope);
  if (tope !== null && (!Number.isFinite(tope) || tope < 0)) return { error: "El tope es un valor en dólares, o vacío para no tener tope." };
  const precios = leerPrecios(String(datos.get("precios") ?? ""));
  if ("error" in precios) return { error: precios.error };

  for (const [clave, valor] of [
    ["ia_umbral", umbral],
    ["ia_tope_usd_mes", tope],
    ["ia_precios", precios.precios],
  ] as const) {
    const { error } = await staff.supabase.rpc("consola_guardar_config_ia", { p_clave: clave, p_valor: valor });
    if (error) return { error: mensajeError(error) };
  }
  revalidatePath("/consola/ia");
  return { ok: "Configuración guardada: rige desde la siguiente lectura." };
}
