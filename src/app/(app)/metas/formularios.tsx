"use client";

import { useActionState } from "react";
import { Campo, Casilla, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { aportar, guardarMeta } from "./acciones";

export function FormularioMeta() {
  const [estado, accion] = useActionState(guardarMeta, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <Campo etiqueta="¿Para qué ahorran?" name="nombre" placeholder="Viaje, matrícula, carro…" required maxLength={80} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Meta" name="monto" />
        <CampoMonto etiqueta="Ya ahorrado" name="ahorrado_inicial" />
        <CampoMonto etiqueta="Aporte mensual" name="aporte_mensual" />
        <Campo etiqueta="Para cuándo" name="fecha_objetivo" type="date" />
      </div>
      <Casilla etiqueta="Es el fondo de emergencia" name="es_emergencia" />
      <MensajeEstado estado={estado} />
      <BotonEnviar>Crear meta</BotonEnviar>
    </form>
  );
}

export function FormularioAporte({ metaId, sugerido, cuentas }: { metaId: string; sugerido: number; cuentas: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState(aportar, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="goal_id" value={metaId} />
      <CampoMonto etiqueta="Aporte" name="monto" valorInicial={sugerido} />
      <Selector etiqueta="Desde la cuenta" name="account_id" defaultValue={cuentas[0]?.id}>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </Selector>
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="secundario" pendiente="Aportando…">
        Aportar
      </BotonEnviar>
    </form>
  );
}
