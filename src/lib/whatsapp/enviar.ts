import "server-only";
import { enviarPlantillaWhatsapp, leerIntegracion } from "@/lib/integraciones/servidor";
import { envios, leerConfigPlataforma } from "@/lib/plataforma/config";
import type { Servicio } from "@/lib/supabase/servicio";
import { dentroDelHorario, parametrosDeUso, type UsoWhatsapp, type UsosWhatsapp, USOS_POR_DEFECTO } from "./usos";

/*
 * Envío de plantillas de WhatsApp de la app (avisos al equipo, cobros y campañas). Solo plantillas aprobadas por
 * Meta; cada envío queda en `mensajes_whatsapp` (destinatario enmascarado) y el webhook sube su estado. Las de
 * marketing respetan el horario de Ajustes de la plataforma → Envíos. Nunca lanza: un WhatsApp que falla no rompe
 * el correo ni la acción que lo pidió.
 */

export type TipoMensaje = "aviso_equipo" | "campana" | "cobro" | "prueba" | "otro";

const enmascarar = (tel: string) => tel.replace(/^(\+\d{2})\d+(\d{2})$/, "$1•••••$2");

export const usosWhatsapp = () => leerConfigPlataforma<UsosWhatsapp>("whatsapp_usos", USOS_POR_DEFECTO);

export async function enviarWhatsapp(
  db: Servicio,
  d: { telefono: string; plantilla: string; parametros: string[]; tipo: TipoMensaje; referencia?: string },
): Promise<{ enviado: boolean; motivo?: string }> {
  try {
    if (!(await leerIntegracion("whatsapp"))) return { enviado: false, motivo: "WhatsApp no está conectado." };
    const { data: p } = await db.from("plantillas_whatsapp").select("idioma, categoria, estado").eq("nombre", d.plantilla).eq("estado", "aprobada").limit(1).maybeSingle();
    if (!p) return { enviado: false, motivo: `La plantilla ${d.plantilla} no está aprobada.` };
    if (p.categoria === "MARKETING") {
      const e = await envios();
      if (!dentroDelHorario(new Date(), e)) return { enviado: false, motivo: "Fuera del horario de envío." };
    }
    const r = await enviarPlantillaWhatsapp(d.telefono, d.plantilla, p.idioma, d.parametros.map((x) => x || "—"));
    await db.from("mensajes_whatsapp").insert({
      wamid: r.ok ? ((r.extra as string | undefined) ?? null) : null,
      tipo: d.tipo,
      referencia: d.referencia ?? null,
      plantilla: d.plantilla,
      para: enmascarar(d.telefono),
      estado: r.ok ? "enviado" : "fallido",
      error: r.ok ? null : r.detalle.slice(0, 300),
    });
    return r.ok ? { enviado: true } : { enviado: false, motivo: r.detalle };
  } catch (e) {
    console.error("[whatsapp]", e);
    return { enviado: false, motivo: "Error al enviar." };
  }
}

/** Envía la plantilla asignada a un uso (Ajustes de la plataforma → WhatsApp) con las variables en su orden. */
export async function enviarUso(db: Servicio, uso: UsoWhatsapp, telefono: string, vars: Record<string, string | undefined>, referencia?: string) {
  const u = (await usosWhatsapp())[uso];
  if (!u?.plantilla) return { enviado: false, motivo: "Sin plantilla asignada." };
  return enviarWhatsapp(db, { telefono, plantilla: u.plantilla, parametros: parametrosDeUso(u, vars), tipo: uso === "aviso_equipo" ? "aviso_equipo" : "cobro", referencia });
}

/** Cobros: a los administradores del hogar que autorizaron WhatsApp. Devuelve cuántos salieron. */
export async function whatsappAdministradores(db: Servicio, hogar: string, uso: UsoWhatsapp, vars: Record<string, string | undefined>, referencia?: string): Promise<number> {
  if (!(await usosWhatsapp())[uso]?.plantilla) return 0;
  const { data: miembros } = await db.from("members").select("nombre, user_id").eq("household_id", hogar).eq("rol", "admin").not("user_id", "is", null);
  const ids = (miembros ?? []).map((m) => m.user_id!);
  if (!ids.length) return 0;
  const { data: tels } = await db.rpc("telefonos_whatsapp", { p_ids: ids });
  let n = 0;
  for (const t of tels ?? []) {
    const nombre = miembros?.find((m) => m.user_id === t.user_id)?.nombre.split(/\s+/)[0];
    if ((await enviarUso(db, uso, t.telefono, { ...vars, nombre }, referencia)).enviado) n++;
  }
  return n;
}
