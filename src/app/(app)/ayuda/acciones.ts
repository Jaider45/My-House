"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerContexto } from "@/lib/sesion";

const CATEGORIAS = ["cuenta", "cobros", "importacion", "ia", "renta", "otro"] as const;

export async function crearTicket(_: Estado, datos: FormData): Promise<Estado> {
  const r = z
    .object({
      asunto: z.string().trim().min(3, "Escribe un asunto corto.").max(120),
      categoria: z.enum(CATEGORIAS),
      cuerpo: z.string().trim().min(5, "Cuéntanos qué pasó.").max(5000),
    })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  const { data, error } = await ctx.supabase.rpc("crear_ticket", { p_hogar: ctx.hogar.id, p_asunto: r.data.asunto, p_categoria: r.data.categoria, p_cuerpo: r.data.cuerpo });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ayuda");
  redirect(`/ayuda/${data}`);
}

export async function responderTicket(_: Estado, datos: FormData): Promise<Estado> {
  const r = z.object({ id: z.uuid(), cuerpo: z.string().trim().max(5000), cerrar: z.enum(["0", "1"]).default("0") }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Escribe tu mensaje." };
  if (!r.data.cuerpo && r.data.cerrar === "0") return { error: "Escribe tu mensaje." };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.rpc("responder_ticket", { p_ticket: r.data.id, p_cuerpo: r.data.cuerpo || (null as unknown as string), p_cerrar: r.data.cerrar === "1" });
  if (error) return { error: mensajeError(error) };
  revalidatePath(`/ayuda/${r.data.id}`);
  revalidatePath("/ayuda");
  return { ok: r.data.cerrar === "1" ? "Solicitud cerrada. Si algo vuelve a fallar, escríbenos aquí mismo." : "Mensaje enviado." };
}

/** Derechos del titular (Ley 1581): conocer, corregir o suprimir sus datos. Responde el equipo dentro del plazo legal. */
export async function solicitarDatos(_: Estado, datos: FormData): Promise<Estado> {
  const r = z
    .object({ tipo: z.enum(["consulta", "actualizacion", "supresion", "revocatoria", "reclamo"]), detalle: z.string().trim().max(2000).default("") })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Elige qué quieres hacer con tus datos." };
  if (r.data.tipo === "supresion" && datos.get("confirmo") !== "on") return { error: "Marca la casilla para confirmar que entiendes lo que se borra." };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.rpc("solicitar_privacidad", { p_tipo: r.data.tipo, p_detalle: r.data.detalle });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ayuda");
  return { ok: "Recibimos tu solicitud. Te respondemos por correo dentro del plazo de ley." };
}

/** El administrador del hogar aprueba, rechaza o revoca el acceso de soporte a sus datos financieros. */
export async function responderAcceso(_: Estado, datos: FormData): Promise<Estado> {
  const r = z.object({ id: z.uuid(), accion: z.enum(["aprobar", "rechazar", "revocar"]) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Solicitud no válida." };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: "Solo el administrador del hogar decide." };
  const { error } = await ctx.supabase.rpc("responder_acceso_soporte", { p_id: r.data.id, p_accion: r.data.accion });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/", "layout");
  return { ok: { aprobar: "Acceso aprobado.", rechazar: "Solicitud rechazada.", revocar: "Acceso revocado." }[r.data.accion] };
}
