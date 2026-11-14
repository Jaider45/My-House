"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { Conmutador } from "@/components/ui/interruptor";
import { guardarIps } from "./acciones";

/** Política «Ingreso solo desde IP permitidas» (diseño Equipo y permisos). */
export function IpsPermitidas({ activo, ips, miIp, puede }: { activo: boolean; ips: string[]; miIp: string; puede: boolean }) {
  const [estado, enviar] = useActionState(guardarIps, null);
  return (
    <form action={enviar} className="flex flex-col gap-2 border-b border-divisor py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-cuerpo">Ingreso solo desde IP permitidas</span>
        {puede ? <Conmutador name="activo" defaultChecked={activo} etiqueta="Ingreso solo desde IP permitidas" /> : <b>{activo ? "Sí" : "No"}</b>}
      </div>
      {puede && (
        <>
          <textarea
            name="ips"
            defaultValue={ips.join("\n")}
            rows={3}
            aria-label="IP o rangos permitidos, uno por línea"
            placeholder={"190.85.10.0/24\n2800:e2:1::5"}
            className="rounded-lg border border-control bg-elevada p-2 font-mono text-[13px]"
          />
          <span className="text-[13px] text-tenue">Una por línea. Tu IP ahora: {miIp || "desconocida"} (debe quedar dentro).</span>
          <BotonEnviar variante="secundario" className="h-8 self-start px-3 text-sm" pendiente="…">
            Guardar
          </BotonEnviar>
          <MensajeEstado estado={estado} />
        </>
      )}
    </form>
  );
}
