"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerContexto } from "@/lib/sesion";
import { formatearFechaLarga, hoy } from "@/lib/fechas";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { correoReporte } from "@/lib/correo/correos";

const esquema = z.object({ persona: z.uuid(), digitos: z.string().regex(/^\d{2}$/, "Escribe los dos últimos dígitos de la cédula.") });

/** Dos últimos dígitos de la cédula de una persona: con ellos sale su fecha para declarar. La base decide quién puede. */
export async function guardarDigitos(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  const { error } = await ctx.supabase.rpc("guardar_digitos_cedula", { p_member: r.data.persona, p_digitos: r.data.digitos });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/impuestos");
  return { ok: "Guardado." };
}

/** «Recordarme» del paso del certificado de ingresos y retenciones: recordatorio el 15 de marzo, 7 y 1 día antes. */
export async function recordarCertificado(): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const anio = Number(hoy().slice(0, 4));
  const fecha = hoy() <= `${anio}-03-15` ? `${anio}-03-15` : `${anio + 1}-03-15`;
  const nombre = "Pedir el certificado de ingresos y retenciones";
  const { data: ya } = await ctx.supabase.from("reminders").select("id").eq("household_id", ctx.hogar.id).eq("nombre", nombre).eq("activo", true).limit(1);
  if (ya?.length) return { ok: "Ya tienes ese recordatorio." };
  const { error } = await ctx.supabase.from("reminders").insert({
    household_id: ctx.hogar.id,
    nombre,
    fecha,
    repetir: "anual",
    avisos: [7, 1],
    canales: ["correo", "notificacion"],
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/recordatorios");
  revalidatePath("/impuestos");
  return { ok: `Listo: te recordamos el ${formatearFechaLarga(fecha)}.` };
}

/**
 * «Enviar el reporte al contador»: correo con los enlaces al reporte (PDF imprimible y Excel) a los contadores del
 * hogar y a quien lo envía. El contador entra con su cuenta de solo lectura: el enlace no abre nada sin sesión.
 */
export async function enviarReporte(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const pedido = String(datos.get("anio") ?? "");
  const anio = /^\d{4}$/.test(pedido) ? Number(pedido) : Number(hoy().slice(0, 4));
  const { data: contadores } = await ctx.supabase.from("members").select("nombre, user_id").eq("household_id", ctx.hogar.id).eq("rol", "contador").not("user_id", "is", null);
  if (!contadores?.length) return { error: "Aún no hay un contador en el hogar. Invítalo primero (solo lectura)." };
  const db = crearClienteServicio();
  const { data: correos } = await db.rpc("correos_de_usuarios", { p_ids: [...contadores.map((c) => c.user_id!), ctx.userId] });
  const porId = new Map((correos ?? []).map((c) => [c.id, c.email]));
  const url = `${sitio()}/reporte-renta?anio=${anio}`;
  const archivos = [
    { nombre: "Reporte (PDF imprimible)", tamano: "En línea" },
    { nombre: "Reporte para Excel (CSV)", tamano: "Descargable" },
  ];
  let enviados = 0;
  for (const p of [...contadores.map((c) => ({ nombre: c.nombre, id: c.user_id! })), { nombre: ctx.miembro.nombre, id: ctx.userId }]) {
    const para = porId.get(p.id);
    if (!para) continue;
    const r = await enviarCorreo({ para, etiqueta: "reporte", contenido: correoReporte({ nombre: p.nombre.split(/\s+/)[0], hogar: ctx.hogar.nombre, anio, archivos, url, sitio: sitio() }) });
    if (r.enviado) enviados++;
  }
  if (!enviados) return { error: "No pudimos enviar el correo ahora. Comparte el reporte con el botón «Exportar reporte»." };
  return { ok: `Enviamos el reporte ${anio} a tu contador${contadores.length > 1 ? "es" : ""} (y una copia para ti).` };
}
