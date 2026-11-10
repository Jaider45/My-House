"use server";

import { redirect } from "next/navigation";
import { mensajeError, type Estado } from "@/lib/acciones";
import { crearClienteConsola } from "@/lib/consola/sesion";

/**
 * Acepta la invitación con la sesión actual (la base exige que el correo coincida) y refresca el token para que
 * traiga el claim `staff`. Luego /consola pide el código o la activación de la verificación en dos pasos.
 */
export async function aceptarInvitacionConsola(_: Estado, datos: FormData): Promise<Estado> {
  const token = String(datos.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "El enlace de la invitación no es válido." };
  const supabase = await crearClienteConsola();
  const { error } = await supabase.rpc("consola_aceptar_invitacion", { p_token: token });
  if (error) return { error: mensajeError(error) };
  await supabase.auth.refreshSession();
  redirect("/consola");
}
