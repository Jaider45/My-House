"use client";

import { useActionState, useState } from "react";
import { Campo, Casilla, Explicacion, Selector } from "@/components/ui";
import { Interruptor } from "@/components/ui/interruptor";
import { avanceMeta } from "@/lib/metas";
import { formatearCOP } from "@/lib/dinero";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { aportar, guardarMeta } from "./acciones";

export function FormularioMeta({ cuentas, hoy }: { cuentas: { id: string; nombre: string }[]; hoy: string }) {
  const [estado, accion] = useActionState(guardarMeta, null);
  useCerrarAlGuardar(estado);
  const [monto, setMonto] = useState(0);
  const [ahorrado, setAhorrado] = useState(0);
  const [cuando, setCuando] = useState("");
  const plan = monto > 0 && cuando ? avanceMeta({ objetivo: monto, ahorrado, aporteMensual: null, fechaObjetivo: `${cuando}-28` }, hoy) : null;
  return (
    <form action={accion} className="flex flex-col gap-4">
      <Campo etiqueta="¿Para qué ahorras?" name="nombre" placeholder="Vacaciones de diciembre 2027" required maxLength={80} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="¿Cuánto necesitas?" name="monto" onCambio={setMonto} />
        <Campo etiqueta="¿Para cuándo?" name="fecha_objetivo" type="month" min={hoy.slice(0, 7)} value={cuando} onChange={(e) => setCuando(e.target.value)} />
      </div>
      <CampoMonto etiqueta="Ya tengo ahorrado" name="ahorrado_inicial" onCambio={setAhorrado} />
      {plan?.aporteSugerido ? (
        <Explicacion>
          Necesitas apartar <b>{formatearCOP(plan.aporteSugerido)} al mes</b> durante {plan.meses} {plan.meses === 1 ? "mes" : "meses"}.
        </Explicacion>
      ) : null}
      <Interruptor name="automatico" titulo="Aportar solo cada mes" texto="El día 1 lo apartamos como pago fijo">
        <Selector etiqueta="Desde la cuenta" name="account_id" defaultValue={cuentas[0]?.id ?? ""}>
          {cuentas.length === 0 && <option value="">Sin cuentas</option>}
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </Interruptor>
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
