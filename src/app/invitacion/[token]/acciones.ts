"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError, type Estado } from "@/lib/acciones";

const esquema = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/),
  nombre: z.string().trim().min(1, "Escriba su nombre.").max(80),
});

export async function aceptarInvitacion(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("aceptar_invitacion", { p_token: r.data.token, p_nombre: r.data.nombre });
  if (error) return { error: mensajeError(error) };
  redirect("/");
}
