"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { correoInvitarContador, correoVerificacionFirma } from "@/lib/correo/correos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";

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

/** «Pagar comisiones»: marca pagadas las pendientes del mes elegido (la transferencia se hace por fuera). */
export async function pagarComisiones(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const mes = z.string().regex(/^\d{4}-\d{2}$/).safeParse(datos.get("mes"));
  if (!mes.success) return { error: "Elige el mes." };
  const { data, error } = await staff.supabase.rpc("consola_pagar_comisiones", { p_mes: mes.data });
  if (error) return { error: mensajeError(error) };
  const r = data as { firmas: number; total: number };
  revalidatePath("/consola/contadores");
  return { ok: `Marcadas como pagadas: ${r.firmas} ${r.firmas === 1 ? "firma" : "firmas"}.` };
}

/** «Invitar contador»: correo con el enlace de registro (queda en la auditoría como campaña uno a uno). */
export async function invitarContador(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("ver_hogares")) return { error: SIN_PERMISO };
  const r = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")), nombre: z.string().trim().min(2, "Escribe el nombre.").max(80) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { data: plan } = await staff.supabase.from("planes").select("limites").eq("codigo", "contador").maybeSingle();
  const comision = Number((plan?.limites as { comision_pct?: number } | null)?.comision_pct ?? 20);
  const url = `${sitio()}/registro?utm_source=contador-invitado&email=${encodeURIComponent(r.data.email)}`;
  const envio = await enviarCorreo({ para: r.data.email, etiqueta: "contador-invitado", contenido: correoInvitarContador({ nombre: r.data.nombre.split(/\s+/)[0], quien: staff.nombre.split(" ")[0], url, comision }) });
  return envio.enviado ? { ok: `Invitación enviada a ${r.data.email}.` } : { error: "No se pudo enviar el correo (revisa Integraciones → Resend)." };
}

/** Solicitud de verificación: aprobar, pedir datos o rechazar. Se le avisa por correo a quien la pidió. */
export async function responderSolicitud(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ id: z.uuid(), accion: z.enum(["aprobar", "pedir_datos", "rechazar"]), mensaje: z.string().max(600).optional(), firma: z.string().max(120) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Solicitud no válida." };
  const { data: pidio, error } = await staff.supabase.rpc("consola_responder_solicitud_contador", { p_id: r.data.id, p_accion: r.data.accion, p_mensaje: r.data.mensaje ?? "" });
  if (error) return { error: mensajeError(error) };
  if (pidio && hayServicio()) {
    const { data: correos } = await crearClienteServicio().rpc("correos_de_usuarios", { p_ids: [pidio as string] });
    const para = correos?.[0]?.email;
    if (para) await enviarCorreo({ para, etiqueta: "contador-verificacion", contenido: correoVerificacionFirma({ firma: r.data.firma, accion: r.data.accion, mensaje: (r.data.mensaje ?? "").trim(), url: `${sitio()}/clientes` }) });
  }
  revalidatePath("/consola/contadores");
  return { ok: r.data.accion === "aprobar" ? "Firma verificada." : r.data.accion === "pedir_datos" ? "Le pedimos los datos por correo." : "Solicitud rechazada." };
}
