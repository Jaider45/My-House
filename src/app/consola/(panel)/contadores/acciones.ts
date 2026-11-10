"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";

const SIN_PERMISO = "Verificar firmas y pagar comisiones es de Finanzas o un superadmin.";

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("cobros") ? staff : null;
}

export async function verificarContador(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ id: z.uuid(), verificada: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Firma no válida." };
  const { error } = await staff.supabase.rpc("consola_verificar_contador", { p_id: r.data.id, p_verificada: r.data.verificada === "true" });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/contadores");
  return { ok: r.data.verificada === "true" ? "Firma verificada." : "Verificación retirada." };
}

export async function liquidarComisiones(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const mes = z.string().regex(/^\d{4}-\d{2}$/).safeParse(datos.get("mes"));
  if (!mes.success) return { error: "Elige el mes." };
  const { data, error } = await staff.supabase.rpc("consola_liquidar_comisiones", { p_mes: `${mes.data}-01` });
  if (error) return { error: mensajeError(error) };
  const r = data as { firmas: number; total: number };
  revalidatePath("/consola/contadores");
  return { ok: r.firmas ? `Listo: ${r.firmas} ${r.firmas === 1 ? "firma" : "firmas"} con comisión en ${mes.data}.` : `Ninguna firma tuvo referidos pagando en ${mes.data}.` };
}

export async function marcarComision(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ id: z.uuid(), pagada: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Comisión no válida." };
  const { error } = await staff.supabase.rpc("consola_marcar_comision", { p_id: r.data.id, p_pagada: r.data.pagada === "true" });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/contadores");
  return { ok: r.data.pagada === "true" ? "Comisión marcada como pagada." : "Comisión reabierta." };
}
