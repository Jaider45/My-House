"use client";

import { useActionState } from "react";
import { Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { guardarDeuda, registrarAbono } from "./acciones";

export function FormularioDeuda() {
  const [estado, accion] = useActionState(guardarDeuda, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <Campo etiqueta="Nombre" name="nombre" placeholder="Sistecredito, préstamo, tarjeta…" required maxLength={80} />
      <Campo etiqueta="Detalle" name="detalle" placeholder="Para qué fue" maxLength={120} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Saldo acordado" name="monto" />
        <CampoMonto etiqueta="Ya pagado" name="pagado_inicial" ayuda="Antes de registrarla aquí." />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CampoMonto etiqueta="Cuota" name="cuota" ayuda="Vacío = abonos libres." />
        <Campo etiqueta="Número de cuotas" name="cuotas_total" type="number" min={1} />
        <Campo etiqueta="Día de pago" name="dia_pago" type="number" min={1} max={31} />
      </div>
      <Campo etiqueta="Fecha límite" name="fecha_limite" type="date" />
      <MensajeEstado estado={estado} />
      <BotonEnviar>Agregar deuda</BotonEnviar>
    </form>
  );
}

export function FormularioAbono({ deudaId, cuota, cuentas }: { deudaId: string; cuota: number | null; cuentas: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState(registrarAbono, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
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
      <BotonEnviar variante="secundario" pendiente="Registrando…">
        Registrar abono
      </BotonEnviar>
    </form>
  );
}
