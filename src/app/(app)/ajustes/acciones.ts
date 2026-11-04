"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";

const rol = z.enum(["admin", "editor", "contador"]);

export async function invitarMiembro(_: Estado, datos: FormData): Promise<Estado & { enlace?: string }> {
  const r = z
    .object({ email: z.string().trim().toLowerCase().pipe(z.email("Escriba un correo válido.")), rol })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: "Solo un administrador puede invitar." };
  const { data, error } = await ctx.supabase
    .from("invitations")
    .insert({ household_id: ctx.hogar.id, email: r.data.email, rol: r.data.rol })
    .select("token")
    .single();
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ajustes/miembros");
  return {
    ok: "Invitación creada. Comparta este enlace (vence en 7 días):",
    enlace: `${process.env.NEXT_PUBLIC_SITE_URL}/invitacion/${data.token}`,
  };
}

export async function revocarInvitacion(datos: FormData) {
  const ctx = await obtenerContexto();
  await ctx.supabase.from("invitations").delete().eq("id", String(datos.get("id")));
  revalidatePath("/ajustes/miembros");
}

export async function agregarDependiente(_: Estado, datos: FormData): Promise<Estado> {
  const r = z.object({ nombre: z.string().trim().min(1, "Escriba el nombre.").max(80) }).safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase
    .from("members")
    .insert({ household_id: ctx.hogar.id, nombre: r.data.nombre, es_dependiente: true });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ajustes/miembros");
  return { ok: `${r.data.nombre} agregado.` };
}

export async function cambiarRol(datos: FormData) {
  const r = z.object({ id: z.uuid(), rol }).safeParse(Object.fromEntries(datos));
  if (!r.success) return;
  const ctx = await obtenerContexto();
  await ctx.supabase.from("members").update({ rol: r.data.rol }).eq("id", r.data.id);
  revalidatePath("/ajustes/miembros");
}

export async function quitarMiembro(datos: FormData) {
  const ctx = await obtenerContexto();
  await ctx.supabase.from("members").delete().eq("id", String(datos.get("id")));
  revalidatePath("/ajustes/miembros");
}

export async function guardarHogar(_: Estado, datos: FormData): Promise<Estado> {
  const r = z
    .object({
      nombre: z.string().trim().min(1, "Póngale un nombre al hogar.").max(80),
      cuota: z.coerce.number().int().min(0, "Entre 0 y 50.").max(50, "Entre 0 y 50."),
    })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase
    .from("households")
    .update({ nombre: r.data.nombre, config: { cuota_imprevistos_pct: r.data.cuota } })
    .eq("id", ctx.hogar.id);
  if (error) return { error: mensajeError(error) };
  revalidatePath("/", "layout");
  return { ok: "Cambios guardados." };
}
