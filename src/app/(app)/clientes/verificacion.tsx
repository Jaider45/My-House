"use client";

import { useActionState } from "react";
import { AreaTexto, Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { solicitarVerificacion } from "./acciones";

type Solicitud = { estado: string; respuesta: string | null; tarjeta: string | null; ciudad: string | null; clientes: number | null } | null;

/** Clientes → «Verificación»: la firma envía su tarjeta profesional; si el equipo pidió datos, ve el mensaje y reenvía. */
export function VerificacionFirma({ firma, solicitud }: { firma: string; solicitud: Solicitud }) {
  const [estado, enviar] = useActionState(solicitarVerificacion, null);
  if (solicitud?.estado === "pendiente" && !estado?.ok) return <p className="text-sm text-cuerpo">Recibimos tu solicitud. Te escribimos cuando la revisemos (máximo 2 días hábiles).</p>;
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="firma" value={firma} />
      {solicitud?.estado === "datos_pedidos" && solicitud.respuesta && <p className="rounded-lg bg-alerta-fondo px-3 py-2 text-sm text-alerta-tinta">Nos falta: {solicitud.respuesta}</p>}
      {solicitud?.estado === "rechazada" && solicitud.respuesta && <p className="rounded-lg bg-error-fondo px-3 py-2 text-sm text-error-tinta">{solicitud.respuesta}</p>}
      <p className="text-sm text-cuerpo">Verificamos tu tarjeta profesional y tus clientes te ven como contador verificado.</p>
      <Campo etiqueta="Tarjeta profesional (número)" name="tarjeta" defaultValue={solicitud?.tarjeta ?? ""} required maxLength={40} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Ciudad" name="ciudad" defaultValue={solicitud?.ciudad ?? ""} maxLength={60} />
        <Campo etiqueta="Clientes por traer" name="clientes" type="number" min={0} max={5000} defaultValue={solicitud?.clientes ?? ""} />
      </div>
      <AreaTexto etiqueta="Algo más (opcional)" name="nota" rows={2} maxLength={600} placeholder="Nombre de la firma ante la Junta Central de Contadores, otros contadores del equipo…" />
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="secundario" pendiente="Enviando…">
        Pedir verificación
      </BotonEnviar>
    </form>
  );
}
