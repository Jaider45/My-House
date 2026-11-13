import "server-only";
import type { Servicio } from "@/lib/supabase/servicio";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { correoAvisoEquipo } from "@/lib/correo/correos";
import { leerConfigPlataforma, type AvisoEquipo } from "@/lib/plataforma/config";
import { chequear, COMPONENTES } from "@/lib/salud";

export type EventoEquipo = "pago_fallido" | "ticket_urgente" | "solicitud_1581" | "servicio_caido" | "plantilla_rechazada";

/**
 * Ajustes de la plataforma → «Avisos para el equipo». Si el evento está activo, manda un correo a las personas del
 * equipo con esos roles (y a los superadmin). `clave` evita repetir el aviso: se reserva en `avisos_equipo_enviados`.
 * Nunca rompe lo que lo llamó.
 */
export async function avisarEquipo(db: Servicio, evento: EventoEquipo, clave: string, d: { titulo: string; texto: string; ruta: string }): Promise<number> {
  try {
    const cfg = await leerConfigPlataforma<Record<string, AvisoEquipo>>("avisos_equipo", {});
    const a = cfg[evento];
    if (!a?.activo) return 0;
    const { error } = await db.from("avisos_equipo_enviados").insert({ clave: `${evento}:${clave}`.slice(0, 200) });
    if (error) return 0; // ya se avisó
    const { data } = await db.rpc("correos_del_equipo", { p_roles: a.roles });
    let n = 0;
    for (const p of data ?? []) {
      const r = await enviarCorreo({ para: p.email, etiqueta: "equipo", contenido: correoAvisoEquipo({ ...d, url: `${sitio()}${d.ruta}` }) });
      if (r.enviado) n++;
    }
    return n;
  } catch (e) {
    console.error("[avisos-equipo]", e);
    return 0;
  }
}

/** Cron diario: tickets urgentes sin respuesta y servicios que no responden. */
export async function revisarAvisosEquipo(db: Servicio, hoy: string) {
  const [{ data: tickets }, salud] = await Promise.all([
    db.rpc("tickets_sin_respuesta"),
    Promise.all(COMPONENTES.map(async (c) => [c, await chequear(c)] as const)),
  ]);
  let avisos = 0;
  for (const t of tickets ?? []) {
    avisos += await avisarEquipo(db, "ticket_urgente", String(t.id), {
      titulo: `Ticket #${t.numero} sin respuesta`,
      texto: `«${t.asunto}» lleva más de una hora sin primera respuesta.`,
      ruta: `/consola/soporte/${t.id}`,
    });
  }
  for (const [c, r] of salud) {
    if (!r.ok) avisos += await avisarEquipo(db, "servicio_caido", `${c}:${hoy}`, { titulo: `El componente «${c}» no responde`, texto: r.motivo ?? "El chequeo de salud falló.", ruta: "/consola/sistema" });
  }
  return avisos;
}
