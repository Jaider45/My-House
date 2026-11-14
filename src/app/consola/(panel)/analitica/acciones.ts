"use server";

import { revalidatePath } from "next/cache";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";

/** Inversión de un mes en un canal (para el CAC). Monto 0 la borra. */
export async function guardarInversion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("cobros")) return { error: "Cargar la inversión es de Finanzas o un superadmin." };
  const mes = String(datos.get("mes") ?? "");
  const canal = String(datos.get("canal") ?? "").trim().toLowerCase();
  const monto = Number(String(datos.get("monto") ?? "").replace(/\D/g, ""));
  if (!/^\d{4}-\d{2}$/.test(mes) || !/^[a-z0-9_-]{1,40}$/.test(canal) || !Number.isFinite(monto)) return { error: "Escribe el mes, el canal (como llega en utm_source) y el monto." };
  const { error } = await staff.supabase.rpc("consola_guardar_inversion", { p_mes: mes, p_canal: canal, p_monto: monto });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/analitica");
  return { ok: monto ? "Guardado." : "Borrado." };
}
