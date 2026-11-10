"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { nombreRol, ROLES_STAFF, type RolStaff } from "@/lib/consola/permisos";
import { correoEquipo } from "@/lib/correo/correos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { formatearFechaLarga, hoy, sumarDias } from "@/lib/fechas";

/*
 * Acciones de Equipo y permisos. Como en la app (decisión 28): permiso primero, sin tocar la base; luego la función
 * de la consola, que vuelve a exigir persona activa, AAL2 y el permiso, y deja el registro en la auditoría.
 */

const SIN_PERMISO = "Solo quien gestiona el equipo puede hacer esto.";
const rol = z.enum(ROLES_STAFF.map((r) => r.valor) as [RolStaff, ...RolStaff[]], "Elige un rol.");
const uuid = z.uuid("Persona no válida.");

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("equipo") ? staff : null;
}

export type EstadoInvitacion = (NonNullable<Estado> & { enlace?: string }) | null;

export async function invitarPersona(_: EstadoInvitacion, datos: FormData): Promise<EstadoInvitacion> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
      nombre: z.string().trim().min(1, "Escribe el nombre.").max(80),
      rol,
    })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };

  const { data: token, error } = await staff.supabase.rpc("consola_invitar", { p_email: r.data.email, p_nombre: r.data.nombre, p_rol: r.data.rol });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");

  const enlace = `${sitio()}/consola/invitacion/${token}`;
  const { enviado } = await enviarCorreo({
    para: r.data.email,
    etiqueta: "equipo",
    contenido: correoEquipo({ quien: staff.nombre, nombre: r.data.nombre, rol: nombreRol(r.data.rol), url: enlace, vence: formatearFechaLarga(sumarDias(hoy(), 7)) }),
  });
  return {
    ok: enviado ? `Enviamos la invitación a ${r.data.email}. También puedes compartir el enlace.` : "Invitación creada. Comparte el enlace (no hay correo configurado).",
    enlace,
  };
}

export async function cambiarRolPersona(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ usuario: uuid, rol }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_cambiar_rol", { p_user: r.data.usuario, p_rol: r.data.rol });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");
  return { ok: "Rol actualizado." };
}

export async function activarPersona(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z.object({ usuario: uuid, activo: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_activar", { p_user: r.data.usuario, p_activo: r.data.activo === "true" });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");
  return { ok: r.data.activo === "true" ? "Acceso reactivado." : "Acceso desactivado." };
}

export async function cancelarInvitacion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return { error: "Invitación no válida." };
  const { error } = await staff.supabase.rpc("consola_cancelar_invitacion", { p_id: id.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");
  return { ok: "Invitación cancelada." };
}
