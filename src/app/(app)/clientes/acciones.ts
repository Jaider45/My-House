"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerContexto } from "@/lib/sesion";

/** Crea (una vez) el código de referido de la firma. La base exige admin y plan Contador. */
export async function crearEnlaceReferido(_: Estado, datos: FormData): Promise<Estado> {
  const id = z.uuid().safeParse(datos.get("firma"));
  if (!id.success) return { error: "Firma no válida." };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.rpc("obtener_ref", { p_hogar: id.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/clientes");
  return { ok: "Enlace creado. Compártelo con tus clientes." };
}

/** La firma pide la verificación con su tarjeta profesional (el equipo la revisa en la consola). */
export async function solicitarVerificacion(_: Estado, datos: FormData): Promise<Estado> {
  const r = z
    .object({
      firma: z.uuid(),
      ciudad: z.string().trim().max(60).optional(),
      tarjeta: z.string().trim().min(3, "Escribe el número de tu tarjeta profesional.").max(40),
      clientes: z.coerce.number().int().min(0).max(5000).optional(),
      nota: z.string().trim().max(600).optional(),
    })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.rpc("solicitar_verificacion_contador", {
    p_firma: r.data.firma,
    p_ciudad: r.data.ciudad ?? "",
    p_tarjeta: r.data.tarjeta,
    p_clientes: (r.data.clientes ?? null) as number,
    p_nota: r.data.nota ?? "",
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/clientes");
  return { ok: "Enviada. Te escribimos cuando la revisemos (máximo 2 días hábiles)." };
}
