"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError, type Estado } from "@/lib/acciones";

const esquema = z.object({
  hogar: z.string().trim().min(1, "Póngale un nombre al hogar.").max(80),
  nombre: z.string().trim().min(1, "Escriba su nombre.").max(80),
});

export async function crearHogar(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("crear_hogar", { p_nombre: r.data.hogar, p_nombre_miembro: r.data.nombre });
  if (error) return { error: mensajeError(error) };
  await supabase.auth.refreshSession(); // el JWT nuevo trae el hogar (custom_access_token_hook)
  redirect("/");
}
