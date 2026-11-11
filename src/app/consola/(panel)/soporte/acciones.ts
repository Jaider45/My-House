"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { correoRespuestaSoporte } from "@/lib/correo/correos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";

const SIN_PERMISO = "Tu rol no responde tickets.";
const ESTADOS = ["abierto", "esperando_cliente", "resuelto"] as const;

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("tickets") ? staff : null;
}

export async function responderTicketConsola(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({ id: z.uuid(), cuerpo: z.string().trim().min(1, "Escribe la respuesta.").max(5000), interno: z.enum(["0", "1"]), estado: z.enum(ESTADOS) })
    .safeParse({ id: datos.get("id"), cuerpo: datos.get("cuerpo"), interno: datos.get("interno") === "on" ? "1" : "0", estado: datos.get("estado") ?? "esperando_cliente" });
  if (!r.success) return { error: r.error.issues[0].message };
  const interno = r.data.interno === "1";
  const { data: correo, error } = await staff.supabase.rpc("consola_responder_ticket", { p_id: r.data.id, p_cuerpo: r.data.cuerpo, p_interno: interno, p_estado: r.data.estado });
  if (error) return { error: mensajeError(error) };
  if (!interno && correo) {
    const { data: t } = await staff.supabase.rpc("consola_ticket", { p_id: r.data.id });
    const ticket = (t as { ticket: { numero: number; asunto: string } } | null)?.ticket;
    if (ticket) {
      await enviarCorreo({
        para: correo,
        etiqueta: "soporte",
        contenido: correoRespuestaSoporte({ numero: ticket.numero, asunto: ticket.asunto, quien: staff.nombre.split(" ")[0], respuesta: r.data.cuerpo, resuelto: r.data.estado === "resuelto", url: `${sitio()}/ayuda/${r.data.id}` }),
      });
    }
  }
  revalidatePath(`/consola/soporte/${r.data.id}`);
  revalidatePath("/consola/soporte");
  return { ok: interno ? "Nota interna guardada." : "Respuesta enviada: le llegó un correo." };
}

export async function actualizarTicket(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({ id: z.uuid(), prioridad: z.enum(["baja", "normal", "alta", "urgente"]), estado: z.enum(ESTADOS), asignado: z.union([z.uuid(), z.literal("")]) })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Datos no válidos." };
  const { error } = await staff.supabase.rpc("consola_actualizar_ticket", {
    p_id: r.data.id,
    p_prioridad: r.data.prioridad,
    p_asignado: (r.data.asignado || null) as string,
    p_escalado: datos.get("escalado") === "on",
    p_estado: r.data.estado,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath(`/consola/soporte/${r.data.id}`);
  revalidatePath("/consola/soporte");
  return { ok: "Ticket actualizado." };
}

export async function guardarRespuestaGuardada(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = z.uuid().safeParse(datos.get("id"));
  const borrar = datos.get("borrar") === "1";
  const r = z.object({ titulo: z.string().trim().min(2, "Escribe un título.").max(80), cuerpo: z.string().trim().min(2, "Escribe el texto.").max(5000) }).safeParse(Object.fromEntries(datos));
  if (!borrar && !r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_guardar_respuesta", {
    p_id: (id.success ? id.data : null) as string,
    p_titulo: r.data?.titulo ?? "",
    p_cuerpo: r.data?.cuerpo ?? "",
    p_borrar: borrar,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/soporte");
  return { ok: borrar ? "Respuesta borrada." : "Respuesta guardada." };
}
