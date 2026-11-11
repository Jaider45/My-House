import type { Tono } from "@/components/ui";

/** Estado de un ticket como lo ve el hogar. */
export const ESTADO_TICKET: Record<string, { texto: string; tono: Tono }> = {
  abierto: { texto: "Esperando al equipo", tono: "alerta" },
  esperando_cliente: { texto: "Te respondimos", tono: "info" },
  resuelto: { texto: "Resuelta", tono: "ok" },
};
