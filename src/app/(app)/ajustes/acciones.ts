"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { fusionarConfigHogar, MAX_CONTEXTO, PARENTESCOS, PATRON_MODELO, PROVEEDORES_IA } from "@/lib/hogar";
import { formatearFechaLarga, hoy } from "@/lib/fechas";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { correoContador, correoInvitacion } from "@/lib/correo/correos";
import type { Json } from "@/lib/supabase/database.types";

const rol = z.enum(["admin", "editor", "contador"]);
const SOLO_ADMIN = "Solo un administrador puede cambiar esto.";

export async function invitarMiembro(_: Estado, datos: FormData): Promise<Estado & { enlace?: string }> {
  const r = z
    .object({ email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")), rol })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: "Solo un administrador puede invitar." };
  const { data, error } = await ctx.supabase
    .from("invitations")
    .insert({ household_id: ctx.hogar.id, email: r.data.email, rol: r.data.rol })
    .select("token, expira_en")
    .single();
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ajustes/miembros");
  const enlace = `${sitio()}/invitacion/${data.token}`;
  const vence = formatearFechaLarga(hoy(new Date(data.expira_en)));
  const datosCorreo = { quien: ctx.miembro.nombre, hogar: ctx.hogar.nombre, url: enlace, vence };
  const { enviado } = await enviarCorreo({
    para: r.data.email,
    etiqueta: r.data.rol === "contador" ? "contador" : "invitacion",
    contenido:
      r.data.rol === "contador"
        ? correoContador({ ...datosCorreo, anio: Number(hoy().slice(0, 4)) })
        : correoInvitacion({ ...datosCorreo, rol: r.data.rol }),
  });
  return {
    ok: enviado
      ? `Le enviamos la invitación a ${r.data.email}. También puedes compartirle este enlace (vence en 7 días):`
      : "Invitación creada. Comparte este enlace (vence en 7 días):",
    enlace,
  };
}

export async function revocarInvitacion(datos: FormData) {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return;
  await ctx.supabase.from("invitations").delete().eq("id", String(datos.get("id")));
  revalidatePath("/ajustes/miembros");
}

const fechaOpcional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || null)
  .pipe(z.iso.date("La fecha de nacimiento no es válida.").nullable());

const esquemaPersona = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional(),
  nombre: z.string().trim().min(1, "Escribe el nombre.").max(80),
  parentesco: z.union([z.enum(Object.keys(PARENTESCOS) as [keyof typeof PARENTESCOS]), z.literal("")]).transform((v) => v || null),
  fecha_nacimiento: fechaOpcional,
  a_cargo_de: z.union([z.uuid(), z.literal("")]).optional().transform((v) => v || null),
  nota: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .pipe(z.string().max(200, "La nota admite 200 caracteres.").nullable()),
  dependiente_dian: z.literal("on").optional().transform(Boolean),
});

/** Crea o edita una persona a cargo (sin acceso a la app): parentesco, edad, quién la tiene a cargo. */
export async function guardarPersonaACargo(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquemaPersona.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const { id, ...persona } = r.data;
  if (persona.fecha_nacimiento && persona.fecha_nacimiento > hoy()) return { error: "La fecha de nacimiento no puede ser futura." };
  const { error } = id
    ? await ctx.supabase.from("members").update(persona).eq("id", id).is("user_id", null)
    : await ctx.supabase.from("members").insert({ ...persona, household_id: ctx.hogar.id, es_dependiente: true });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ajustes/miembros");
  revalidatePath("/impuestos");
  return { ok: id ? "Cambios guardados." : `${persona.nombre} agregado.` };
}

export async function cambiarRol(datos: FormData) {
  const r = z.object({ id: z.uuid(), rol }).safeParse(Object.fromEntries(datos));
  if (!r.success) return;
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return;
  await ctx.supabase.from("members").update({ rol: r.data.rol }).eq("id", r.data.id);
  if (r.data.id === ctx.miembro.id) await ctx.supabase.auth.refreshSession();
  revalidatePath("/ajustes/miembros");
}

export async function quitarMiembro(datos: FormData) {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return;
  await ctx.supabase.from("members").delete().eq("id", String(datos.get("id")));
  revalidatePath("/ajustes/miembros");
}

/** Lee la configuración actual para fusionar: así un formulario no borra lo que guardó otro. */
async function configActual(ctx: Awaited<ReturnType<typeof obtenerContexto>>) {
  const { data } = await ctx.supabase.from("households").select("config").eq("id", ctx.hogar.id).single();
  return data?.config ?? {};
}

export async function guardarHogar(_: Estado, datos: FormData): Promise<Estado> {
  const r = z
    .object({
      nombre: z.string().trim().min(1, "Ponle un nombre al hogar.").max(80),
      ciudad: z
        .string()
        .optional()
        .transform((v) => v?.trim() || null)
        .pipe(z.string().max(60).nullable()),
      cuota: z.coerce.number().int().min(0, "Entre 0 y 50.").max(50, "Entre 0 y 50."),
      contexto: z
        .string()
        .optional()
        .transform((v) => v?.trim() ?? "")
        .pipe(z.string().max(MAX_CONTEXTO, `El contexto admite ${MAX_CONTEXTO} caracteres.`)),
    })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const config = fusionarConfigHogar(await configActual(ctx), { cuota_imprevistos_pct: r.data.cuota, contexto: r.data.contexto });
  const { error } = await ctx.supabase
    .from("households")
    .update({ nombre: r.data.nombre, ciudad: r.data.ciudad, config: config as { [k: string]: Json } })
    .eq("id", ctx.hogar.id);
  if (error) return { error: mensajeError(error) };
  await ctx.supabase.auth.refreshSession(); // el nombre y la cuota viajan en el JWT
  revalidatePath("/", "layout");
  return { ok: "Cambios guardados." };
}

/** Proveedor y modelo de IA del hogar. Vacío = lo que diga el servidor. */
export async function guardarAsistente(_: Estado, datos: FormData): Promise<Estado> {
  const r = z
    .object({
      proveedor: z.union([z.enum(PROVEEDORES_IA), z.literal("")]).transform((v) => v || null),
      modelo: z
        .string()
        .optional()
        .transform((v) => v?.trim() || null)
        .pipe(z.string().regex(PATRON_MODELO, "El nombre del modelo solo lleva letras, números, punto, guion o dos puntos.").nullable()),
    })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const ia = { proveedor: r.data.proveedor, modelo: r.data.proveedor ? r.data.modelo : null };
  const { error } = await ctx.supabase
    .from("households")
    .update({ config: fusionarConfigHogar(await configActual(ctx), { ia }) as { [k: string]: Json } })
    .eq("id", ctx.hogar.id);
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ajustes/hogar");
  revalidatePath("/comprobantes");
  return { ok: "Asistente actualizado." };
}
