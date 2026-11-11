"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import type { Permiso } from "@/lib/consola/permisos";
import { correoPedidoAcceso } from "@/lib/correo/correos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";

/* Acciones del detalle de hogar. Permiso primero (sin tocar la base); la función consola_* lo vuelve a exigir y audita. */

const uuid = z.uuid("Hogar no válido.");
const motivo = z.string().trim().min(3, "Escribe el motivo.").max(300);

async function con(permiso: Permiso) {
  const staff = await obtenerStaff();
  return staff.puede(permiso) ? staff : null;
}
const SIN_PERMISO = "Tu rol no tiene permiso para esto.";
const refrescar = (id: string) => {
  revalidatePath(`/consola/hogares/${id}`);
  revalidatePath("/consola/hogares");
};

export async function cambiarPlanHogar(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await con("cobros");
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ id: uuid, plan: z.string().regex(/^[a-z][a-z_]{1,30}$/, "Plan no válido."), motivo }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_cambiar_plan", { p_id: r.data.id, p_plan: r.data.plan, p_motivo: r.data.motivo });
  if (error) return { error: mensajeError(error) };
  refrescar(r.data.id);
  return { ok: "Plan cambiado." };
}

export async function suspenderHogar(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await con("cobros");
  if (!staff) return { error: SIN_PERMISO };
  const suspender = datos.get("suspender") === "true";
  const r = z.object({ id: uuid, motivo: suspender ? motivo : z.string().optional() }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_suspender", { p_id: r.data.id, p_suspender: suspender, p_motivo: r.data.motivo ?? "" });
  if (error) return { error: mensajeError(error) };
  refrescar(r.data.id);
  return { ok: suspender ? "Hogar suspendido: queda en solo lectura." : "Hogar reactivado." };
}

export async function agregarNota(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await con("ver_hogares");
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ id: uuid, texto: z.string().trim().min(1, "Escribe la nota.").max(2000) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_nota_hogar", { p_id: r.data.id, p_texto: r.data.texto });
  if (error) return { error: mensajeError(error) };
  refrescar(r.data.id);
  return { ok: "Nota guardada." };
}

export async function registrarReembolso(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await con("cobros");
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ hogar: uuid, cobro: z.uuid("Cobro no válido."), motivo }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_marcar_reembolso", { p_cobro: r.data.cobro, p_motivo: r.data.motivo, p_bajar_plan: datos.get("bajar") === "on" });
  if (error) return { error: mensajeError(error) };
  refrescar(r.data.hogar);
  revalidatePath("/consola/cobros");
  return { ok: "Reembolso registrado. Devuelve el dinero desde el panel de Wompi." };
}

/** Pide al administrador del hogar permiso para ver sus datos financieros (le llega un correo y un aviso en la app). */
export async function pedirAccesoFinanzas(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("ver_finanzas")) return { error: "Tu rol no puede ver datos financieros de un hogar." };
  const r = z
    .object({ hogar: z.uuid(), motivo: z.string().trim().min(10, "Explica el motivo: es lo que verá el administrador.").max(300), horas: z.coerce.number().int().min(1).max(72) })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { data: correos, error } = await staff.supabase.rpc("consola_pedir_acceso", { p_hogar: r.data.hogar, p_motivo: r.data.motivo, p_horas: r.data.horas });
  if (error) return { error: mensajeError(error) };
  const { data: h } = await staff.supabase.rpc("consola_hogar", { p_id: r.data.hogar });
  const nombre = (h as { hogar?: { nombre: string } } | null)?.hogar?.nombre ?? "tu hogar";
  await Promise.all(
    (correos ?? []).map((para) =>
      enviarCorreo({ para, etiqueta: "acceso_soporte", contenido: correoPedidoAcceso({ hogar: nombre, quien: staff.nombre.split(" ")[0], motivo: r.data.motivo, horas: r.data.horas, url: `${sitio()}/`, sitio: sitio() }) }),
    ),
  );
  revalidatePath(`/consola/hogares/${r.data.hogar}`);
  return { ok: "Solicitud enviada: el administrador la ve al abrir la app y por correo." };
}
