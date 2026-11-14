"use client";

import { useActionState, useState } from "react";
import { AreaTexto, Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { invitarContador, responderSolicitud } from "./acciones";

export function FormularioInvitarContador() {
  const [estado, enviar] = useActionState(invitarContador, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Campo etiqueta="Nombre" name="nombre" required maxLength={80} />
      <Campo etiqueta="Correo" name="email" type="email" required />
      <p className="text-[13px] text-tenue">Le llega un correo con el enlace para crear su cuenta, activar el plan Contador y pedir la verificación.</p>
      <MensajeEstado estado={estado} />
      <PieVentana pendiente="Enviando…">Enviar invitación</PieVentana>
    </form>
  );
}

/** Aprobar, pedir datos o rechazar una solicitud (pedir datos y rechazar exigen el mensaje). */
export function ResponderSolicitud({ id, firma }: { id: string; firma: string }) {
  const [estado, enviar] = useActionState(responderSolicitud, null);
  const [mensaje, setMensaje] = useState("");
  const [abierta, setAbierta] = useState(false);
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="firma" value={firma} />
      {abierta && <AreaTexto etiqueta="Mensaje para la firma" name="mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} maxLength={600} placeholder="Adjunta una foto de tu tarjeta profesional por ambas caras." />}
      <div className="flex flex-wrap gap-2">
        <BotonEnviar name="accion" value="aprobar" className="h-8 px-3 text-sm" pendiente="…">
          Aprobar
        </BotonEnviar>
        {abierta ? (
          <>
            <BotonEnviar name="accion" value="pedir_datos" variante="secundario" className="h-8 px-3 text-sm" pendiente="…" disabled={mensaje.trim().length < 5}>
              Pedir datos
            </BotonEnviar>
            <BotonEnviar name="accion" value="rechazar" variante="fantasma" className="h-8 px-3 text-sm text-error-tinta" pendiente="…" disabled={mensaje.trim().length < 5}>
              Rechazar
            </BotonEnviar>
          </>
        ) : (
          <button type="button" onClick={() => setAbierta(true)} className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold hover:bg-mosaico">
            Pedir datos o rechazar
          </button>
        )}
      </div>
      <MensajeEstado estado={estado} />
    </form>
  );
}
