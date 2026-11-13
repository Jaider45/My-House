"use client";

import { useActionState } from "react";
import { Campo, Selector } from "@/components/ui";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { guardarDeuda, registrarAbono } from "./acciones";

export function FormularioDeuda() {
  const [estado, accion] = useActionState(guardarDeuda, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <Campo etiqueta="¿A quién le debes?" name="nombre" placeholder="Banco Davivienda, Sistecredito, préstamo de mamá…" required maxLength={80} />
      <Campo etiqueta="Para qué fue" name="detalle" placeholder="Crédito de libre inversión, nevera a 12 cuotas…" maxLength={120} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Monto acordado" name="monto" />
        <CampoMonto etiqueta="Ya pagado" name="pagado_inicial" ayuda="Lo que abonaste antes de registrarla aquí." />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Cuota mensual" name="cuota" ayuda="Vacío = abonos libres." />
        <Campo etiqueta="Número de cuotas" name="cuotas_total" type="number" min={1} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Día de pago" name="dia_pago" type="number" min={1} max={31} />
        <Campo etiqueta="Fecha límite" name="fecha_limite" type="date" />
      </div>
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar deuda</PieVentana>
    </form>
  );
}

export function FormularioAbono({ deudaId, cuota, cuentas }: { deudaId: string; cuota: number | null; cuentas: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState(registrarAbono, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="debt_id" value={deudaId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Monto del abono" name="monto" valorInicial={cuota ?? 0} />
        <Selector etiqueta="Desde la cuenta" name="account_id" defaultValue={cuentas[0]?.id}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </div>
      <MensajeEstado estado={estado} />
      <PieVentana pendiente="Registrando…">Registrar abono</PieVentana>
    </form>
  );
}
