"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/sesion";

/** La persona cierra una oferta: no la vuelve a ver (en ningún dispositivo). */
export async function cerrarOferta(datos: FormData) {
  const id = String(datos.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const ctx = await obtenerContexto();
  await ctx.supabase.rpc("cerrar_oferta", { p_id: id });
  revalidatePath("/", "layout");
}
