"use client";

import { useActionState, useState } from "react";
import { Campo, Explicacion, Selector } from "@/components/ui";
import { planCuota } from "@/lib/deudas";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { guardarDeuda, registrarAbono } from "./acciones";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function FormularioDeuda({ cuentas, hoy }: { cuentas: { id: string; nombre: string }[]; hoy: string }) {
  const [estado, accion] = useActionState(guardarDeuda, null);
  useCerrarAlGuardar(estado);
  const [monto, setMonto] = useState(0);
  const [pagado, setPagado] = useState(0);
  const [cuota, setCuota] = useState(0);
  const [cuotas, setCuotas] = useState("");
  const [dia, setDia] = useState(10);
  const plan = cuota > 0 && monto > 0 ? planCuota({ monto, pagado_inicial: pagado, cuota, cuotas_total: Number(cuotas) || null, dia_pago: dia, hoy }) : null;
  return (
    <form action={accion} className="flex flex-col gap-4">
      <Campo etiqueta="¿A quién le debes?" name="nombre" placeholder="Banco Davivienda · crédito de libre inversión" required maxLength={80} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Monto acordado" name="monto" onCambio={setMonto} />
        <CampoMonto etiqueta="Ya pagado" name="pagado_inicial" onCambio={setPagado} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Cuota mensual" name="cuota" ayuda="Vacío = abonos libres." onCambio={setCuota} />
        <Campo etiqueta="Número de cuotas" name="cuotas_total" type="number" min={1} max={600} value={cuotas} onChange={(e) => setCuotas(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Selector etiqueta="Día de pago" name="dia_pago" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Día {i + 1}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Se paga desde" name="account_id" defaultValue={cuentas[0]?.id ?? ""}>
          {cuentas.length === 0 && <option value="">Sin cuentas</option>}
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </div>
      {plan && (
        <Explicacion>
          Terminarías en{" "}
          <b>
            {MESES[Number(plan.ultima.slice(5, 7)) - 1]} de {plan.ultima.slice(0, 4)}
          </b>{" "}
          ({plan.cuotas} {plan.cuotas === 1 ? "cuota" : "cuotas"}). Crearemos el pago fijo de la cuota y te avisaremos 3 días antes.
        </Explicacion>
      )}
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
