"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { reglaValida } from "@/lib/consola/ips";
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
const FIJOS = ROLES_STAFF.map((r) => r.valor) as string[];
/** El selector de rol manda un rol fijo («soporte») o uno propio («propio:<uuid>»). */
const rol = z
  .string("Elige un rol.")
  .refine((v) => FIJOS.includes(v) || /^propio:[0-9a-f-]{36}$/.test(v), "Elige un rol.")
  .transform((v) => (v.startsWith("propio:") ? { p_rol: "soporte" as RolStaff, p_rol_personal: v.slice(7) } : { p_rol: v as RolStaff, p_rol_personal: undefined }));
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

  const { data: token, error } = await staff.supabase.rpc("consola_invitar", { p_email: r.data.email, p_nombre: r.data.nombre, ...r.data.rol });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");

  const enlace = `${sitio()}/consola/invitacion/${token}`;
  const { enviado } = await enviarCorreo({
    para: r.data.email,
    etiqueta: "equipo",
    contenido: correoEquipo({ quien: staff.nombre, nombre: r.data.nombre, rol: String(datos.get("rol_nombre") || nombreRol(r.data.rol.p_rol)), url: enlace, vence: formatearFechaLarga(sumarDias(hoy(), 7)) }),
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
  const { error } = await staff.supabase.rpc("consola_cambiar_rol", { p_user: r.data.usuario, ...r.data.rol });
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

/** «Ingreso solo desde IP permitidas»: una regla por línea (IP o rango). La base exige que tu IP quede dentro. */
export async function guardarIps(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("equipo")) return { error: "Solo un superadmin cambia las políticas de acceso." };
  const ips = String(datos.get("ips") ?? "")
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const malas = ips.filter((x) => !reglaValida(x));
  if (malas.length) return { error: `No es una IP o rango válido: ${malas.join(", ")}` };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const { error } = await staff.supabase.rpc("consola_guardar_ips", { p_activo: datos.get("activo") === "1", p_ips: ips, p_ip_actual: ip });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");
  return { ok: "Guardado. Aplica en máximo un minuto." };
}

/** «Nuevo rol» / editar o borrar un rol propio: nombre, descripción y permisos de la matriz. */
export async function guardarRol(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = String(datos.get("id") ?? "");
  if (id && !uuid.safeParse(id).success) return { error: "Rol no válido." };
  const borrar = datos.get("borrar") === "1";
  const nombre = String(datos.get("nombre") ?? "").trim();
  const permisos = datos.getAll("permisos").map(String);
  if (!borrar && (nombre.length < 2 || nombre.length > 40)) return { error: "El nombre del rol va de 2 a 40 caracteres." };
  if (!borrar && !permisos.length) return { error: "Elige al menos un permiso." };
  const { error } = await staff.supabase.rpc("consola_guardar_rol", {
    p: { id: id || null, nombre, descripcion: String(datos.get("descripcion") ?? "").trim().slice(0, 200), permisos, borrar },
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");
  return { ok: borrar ? "Rol borrado." : id ? "Rol actualizado." : "Rol creado. Ya puedes asignarlo o invitar con él." };
}

/** «Cerrar sesión por inactividad» de la consola (minutos). El proxy lo lee con caché de un minuto. */
export async function guardarInactividad(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const minutos = Number(datos.get("minutos"));
  if (!Number.isInteger(minutos) || minutos < 5 || minutos > 240) return { error: "Elige entre 5 y 240 minutos." };
  const { error } = await staff.supabase.rpc("consola_guardar_ajuste", { p_clave: "consola_sesion", p_valor: { minutos } });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");
  return { ok: "Guardado. Aplica en máximo un minuto." };
}

/** Celular propio para recibir los avisos del equipo por WhatsApp. */
export async function guardarMiCelular(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  const { error } = await staff.supabase.rpc("guardar_contacto", { p_telefono: String(datos.get("telefono") ?? ""), p_whatsapp: datos.get("whatsapp") === "1" });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/equipo");
  return { ok: "Guardado." };
}
