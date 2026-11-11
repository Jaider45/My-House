"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { CasillasLegales } from "@/components/casillas-legales";
import { aceptarInvitacion } from "./acciones";

export function FormularioAceptar({ token, nombre, pedirConsentimiento }: { token: string; nombre: string; pedirConsentimiento: boolean }) {
  const [estado, accion] = useActionState(aceptarInvitacion, null);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Campo etiqueta="Tu nombre" name="nombre" defaultValue={nombre} required maxLength={80} />
      {pedirConsentimiento && <CasillasLegales />}
      <MensajeEstado estado={estado} />
      <BotonEnviar className="w-full" pendiente="Uniéndome…">
        Unirme al hogar
      </BotonEnviar>
    </form>
  );
}
