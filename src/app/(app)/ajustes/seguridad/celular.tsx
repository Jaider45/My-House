"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { Conmutador } from "@/components/ui/interruptor";
import { guardarCelular } from "./acciones";

/** Configuración → Seguridad → «Tu celular»: para avisos por WhatsApp (pagos, plan y novedades si las aceptaste). */
export function FormularioCelular({ telefono, whatsapp }: { telefono: string | null; whatsapp: boolean }) {
  const [estado, enviar] = useActionState(guardarCelular, null);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Campo etiqueta="Celular" name="telefono" type="tel" inputMode="tel" autoComplete="tel" defaultValue={telefono ?? ""} placeholder="+57 300 123 4567" />
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          <b className="block">Recibir avisos por WhatsApp</b>
          <span className="text-[13px] text-tenue">Pagos del plan y, si aceptaste novedades, consejos y ofertas. Responde BAJA para dejar de recibirlos.</span>
        </span>
        <Conmutador name="whatsapp" defaultChecked={whatsapp} etiqueta="Recibir avisos por WhatsApp" />
      </div>
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="secundario" pendiente="Guardando…">
        Guardar celular
      </BotonEnviar>
    </form>
  );
}
