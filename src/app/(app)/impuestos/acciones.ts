"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerContexto } from "@/lib/sesion";

const esquema = z.object({ persona: z.uuid(), digitos: z.string().regex(/^\d{2}$/, "Escribe los dos últimos dígitos de la cédula.") });

/** Dos últimos dígitos de la cédula de una persona: con ellos sale su fecha para declarar. La base decide quién puede. */
export async function guardarDigitos(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.rpc("guardar_digitos_cedula", { p_member: r.data.persona, p_digitos: r.data.digitos });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/impuestos");
  return { ok: "Guardado." };
}
