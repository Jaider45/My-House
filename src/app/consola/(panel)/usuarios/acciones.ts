"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";

const uuid = z.uuid("Cuenta no válida.");
const SIN_PERMISO = "Tu rol no tiene permiso para esto.";

/** Ver el correo completo (queda en la auditoría). Devuelve el correo para mostrarlo en la fila. */
export async function verCorreo(usuario: string): Promise<{ error?: string; email?: string }> {
  const staff = await obtenerStaff();
  if (!staff.puede("ver_hogares")) return { error: SIN_PERMISO };
  const id = uuid.safeParse(usuario);
  if (!id.success) return { error: "Cuenta no válida." };
  const { data, error } = await staff.supabase.rpc("consola_ver_correo", { p_user: id.data });
  return error ? { error: mensajeError(error) } : { email: data as string };
}

export async function cerrarSesiones(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("usuarios")) return { error: SIN_PERMISO };
  const id = uuid.safeParse(datos.get("usuario"));
  if (!id.success) return { error: "Cuenta no válida." };
  const { data, error } = await staff.supabase.rpc("consola_cerrar_sesiones", { p_user: id.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/usuarios");
  return { ok: `${data} ${data === 1 ? "sesión cerrada" : "sesiones cerradas"}.` };
}

export async function restablecerDosPasos(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("usuarios")) return { error: SIN_PERMISO };
  const id = uuid.safeParse(datos.get("usuario"));
  if (!id.success) return { error: "Cuenta no válida." };
  const { error } = await staff.supabase.rpc("consola_restablecer_2fa", { p_user: id.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/usuarios");
  return { ok: "Verificación restablecida: al entrar podrá activarla de nuevo." };
}
