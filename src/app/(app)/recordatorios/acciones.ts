"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { parsearFecha } from "@/lib/fechas";
import { idDe, mensajeError, NO_ENCONTRADO, SOLO_ADMIN, SOLO_LECTURA, type Estado } from "@/lib/acciones";
import { fusionarConfigHogar, leerConfigHogar } from "@/lib/hogar";
import type { Json } from "@/lib/supabase/database.types";

const esquema = z.object({
  nombre: z.string().trim().min(1, "¿Qué hay que pagar?").max(80),
  fecha: z.string().transform((v, c) => parsearFecha(v) ?? (c.addIssue({ code: "custom", message: "Escribe la fecha." }), "")),
  monto: z.coerce.number().int().min(0),
  repetir: z.enum(["una_vez", "mensual", "anual"]),
  avisos: z.array(z.coerce.number().int().refine((n) => [0, 1, 3, 7, 14, 30].includes(n))).min(1, "Elige cuándo avisar."),
  canales: z.array(z.enum(["whatsapp", "correo", "notificacion"])).min(1, "Elige por dónde avisar."),
});

export async function guardarRecordatorio(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse({
    ...Object.fromEntries(datos),
    avisos: datos.getAll("avisos"),
    canales: datos.getAll("canales"),
  });
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const { monto, ...resto } = r.data;
  const { error } = await ctx.supabase.from("reminders").insert({ ...resto, monto: monto || null, household_id: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/recordatorios");
  return { ok: "Recordatorio guardado." };
}

/** Prende o apaga un recordatorio (`tipo` = recordatorio) o el aviso de un pago fijo (`tipo` = regla). */
export async function cambiarRecordatorio(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  const id = idDe(datos);
  if (!id) return { error: NO_ENCONTRADO };
  const activo = datos.get("activo") === "1";
  const { data, error } =
    datos.get("tipo") === "regla"
      ? await ctx.supabase.from("recurring_rules").update({ recordar: activo }).eq("id", id).select("id")
      : await ctx.supabase.from("reminders").update({ activo }).eq("id", id).select("id");
  if (error) return { error: mensajeError(error) };
  if (!data.length) return { error: NO_ENCONTRADO };
  revalidatePath("/recordatorios");
  return { ok: activo ? "Recordatorio activado." : "Recordatorio pausado." };
}

/** Prende o apaga el resumen semanal por correo del hogar (solo administradores). */
export async function cambiarResumenSemanal(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const { data, error: eLeer } = await ctx.supabase.from("households").select("config").eq("id", ctx.hogar.id).single();
  if (eLeer) return { error: mensajeError(eLeer) };
  const activo = datos.get("activo") === "1";
  const correo = { ...leerConfigHogar(data.config).correo, resumen_semanal: activo };
  const { data: hogar, error } = await ctx.supabase
    .from("households")
    .update({ config: fusionarConfigHogar(data.config, { correo }) as { [k: string]: Json } })
    .eq("id", ctx.hogar.id)
    .select("id");
  if (error) return { error: mensajeError(error) };
  if (!hogar.length) return { error: SOLO_ADMIN };
  revalidatePath("/recordatorios");
  return { ok: activo ? "Resumen semanal activado." : "Resumen semanal apagado." };
}
