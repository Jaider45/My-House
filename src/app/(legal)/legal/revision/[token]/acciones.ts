"use server";

import { mensajeError, type Estado } from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";
import { origenSolicitud } from "@/lib/legal/servidor";

/** El abogado aprueba o pide cambios con el token del enlace (sin cuenta). Queda en la auditoría con su IP. */
export async function responderRevision(_: Estado, datos: FormData): Promise<Estado> {
  const token = String(datos.get("token") ?? "");
  const aprobada = datos.get("decision") === "aprobar";
  const { ip, agente } = await origenSolicitud();
  const supabase = await crearClienteServidor({ ...(ip && { "x-mh-ip": ip }), ...(agente && { "x-mh-agente": agente }) });
  const { error } = await supabase.rpc("revision_legal_responder", {
    p_token: token,
    p_aprobada: aprobada,
    p_nombre: String(datos.get("nombre") ?? ""),
    p_nota: String(datos.get("nota") ?? ""),
  });
  if (error) return { error: mensajeError(error) };
  return { ok: aprobada ? "Gracias. Quedó aprobada; el equipo ya puede publicarla." : "Gracias. Le avisamos al equipo qué cambiar." };
}
