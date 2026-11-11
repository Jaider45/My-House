"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError, type Estado } from "@/lib/acciones";
import { exigirConsentimiento } from "@/lib/legal/servidor";

const esquema = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/),
  nombre: z.string().trim().min(1, "Escribe tu nombre.").max(80),
});

export async function aceptarInvitacion(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión terminó. Vuelve a ingresar." };
  const falta = await exigirConsentimiento(supabase, sesion.user.id, datos);
  if (falta) return { error: falta };
  const { error } = await supabase.rpc("aceptar_invitacion", { p_token: r.data.token, p_nombre: r.data.nombre });
  if (error) return { error: mensajeError(error) };
  await supabase.auth.refreshSession(); // el JWT nuevo trae el hogar (custom_access_token_hook)
  redirect("/");
}
