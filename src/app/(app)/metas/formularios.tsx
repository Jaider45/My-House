"use client";

import { useActionState } from "react";
import { Campo, Casilla, Selector } from "@/components/ui";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { aportar, guardarMeta } from "./acciones";

export function FormularioMeta() {
  const [estado, accion] = useActionState(guardarMeta, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <Campo etiqueta="¿Para qué ahorras?" name="nombre" placeholder="Vacaciones de diciembre, matrícula, carro…" required maxLength={80} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="¿Cuánto necesitas?" name="monto" />
        <Campo etiqueta="¿Para cuándo?" name="fecha_objetivo" type="date" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Ya tengo ahorrado" name="ahorrado_inicial" />
        <CampoMonto etiqueta="Aporte de cada mes" name="aporte_mensual" ayuda="Con la fecha te decimos si alcanza." />
      </div>
      <Casilla etiqueta="Es el fondo de emergencia" name="es_emergencia" />
      <MensajeEstado estado={estado} />
      <PieVentana>Crear meta</PieVentana>
    </form>
  );
}

export function FormularioAporte({ metaId, sugerido, cuentas }: { metaId: string; sugerido: number; cuentas: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState(aportar, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={accion} className="flex flex-col gap-4">
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
      <PieVentana pendiente="Aportando…">Aportar</PieVentana>
    </form>
  );
}
