"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";

export async function guardarFuncion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("sistema")) return { error: "Solo un superadmin enciende o apaga funciones." };
  const r = z
    .object({
      clave: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, "La clave va en minúsculas y sin espacios (ej.: pronostico_gastos)."),
      descripcion: z.string().trim().max(200).default(""),
      porcentaje: z.coerce.number().int().min(0, "El porcentaje va de 0 a 100.").max(100, "El porcentaje va de 0 a 100."),
    })
    .safeParse({ clave: datos.get("clave"), descripcion: datos.get("descripcion") ?? "", porcentaje: datos.get("porcentaje") ?? 100 });
  if (!r.success) return { error: r.error.issues[0].message };
  const planes = datos.getAll("planes").map(String).filter((p) => /^[a-z][a-z_]{1,30}$/.test(p));
  const { error } = await staff.supabase.rpc("consola_guardar_funcion", {
    p_clave: r.data.clave,
    p_descripcion: r.data.descripcion,
    p_activa: datos.get("activa") === "on",
    p_planes: planes,
    p_porcentaje: r.data.porcentaje,
    p_solo_equipo: datos.get("solo_equipo") === "on",
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/sistema");
  return { ok: `«${r.data.clave}» guardada: rige desde el siguiente clic de cada persona.` };
}
