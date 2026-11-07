"use client";

import { useState, type ReactNode } from "react";
import { Chip, CuadroIcono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { digitosAMonto, formatearCOP, formatearMiles } from "@/lib/dinero";
import type { NombreIcono } from "@/components/marca";
import { guardarPresupuesto } from "./acciones";

export type FilaEdicion = {
  id: string;
  nombre: string;
  icono: NombreIcono;
  esencial: boolean;
  fijos: number;
  /** Pagos fijos de la categoría (descripción y equivalente mensual). */
  pagos: { descripcion: string; mensual: number }[];
  variable: number;
  promedio3: number;
};

/** Edición del gasto variable mensual de cada categoría, con el total del presupuesto en vivo. */
export function FormularioPresupuesto({ filas, mes, cancelar }: { filas: FilaEdicion[]; mes: string; cancelar: ReactNode }) {
  const [valores, setValores] = useState<Record<string, number>>(Object.fromEntries(filas.map((f) => [f.id, f.variable])));
  const fijos = filas.reduce((s, f) => s + f.fijos, 0);
  const variable = Object.values(valores).reduce((s, v) => s + v, 0);
  const esencial = filas.filter((f) => f.esencial).reduce((s, f) => s + f.fijos + (valores[f.id] ?? 0), 0);

  return (
    <form action={guardarPresupuesto} className="space-y-4">
      <input type="hidden" name="mes" value={mes} />
      <p className="text-sm text-cuerpo">
        Los <b>pagos fijos</b> (arriendo, colegio, servicios…) ya cuentan solos: agrégalos o cámbialos en «Pagos fijos», más
        abajo. Aquí escribe cuánto planeas gastar <b>además</b> en cada categoría (mercado, transporte, salidas…). Se repite
        cada mes hasta que lo cambies.
      </p>
      <div className="overflow-hidden rounded-2xl border border-borde bg-elevada">
        {filas.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 border-b border-divisor px-4 py-3 last:border-b-0 md:px-6">
            <CuadroIcono nombre={f.icono} />
            <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <b className="text-[15px]">{f.nombre}</b>
                {f.esencial && <Chip tono="info">Esencial</Chip>}
              </span>
              <span className="text-[13px] text-cuerpo">
                {f.pagos.length
                  ? `Pagos fijos ${formatearCOP(f.fijos)}: ${f.pagos.map((p) => p.descripcion).join(", ")}`
                  : "Sin pagos fijos"}
              </span>
              {f.promedio3 > 0 && <span className="text-[13px] text-tenue">Promedio de los últimos 3 meses: {formatearCOP(f.promedio3)}</span>}
            </span>
            <label className="flex flex-col items-end gap-1">
              <span className="text-[12px] font-semibold text-cuerpo">Gasto variable</span>
              <span className="flex items-center gap-2 rounded-lg border border-control bg-elevada px-3 focus-within:border-monte">
                <span className="text-cuerpo">$</span>
                <input
                  name={`adicional:${f.id}`}
                  inputMode="numeric"
                  value={valores[f.id] ? formatearMiles(valores[f.id]) : ""}
                  onChange={(e) => setValores({ ...valores, [f.id]: digitosAMonto(e.target.value) })}
                  placeholder="0"
                  aria-label={`Gasto variable de ${f.nombre}`}
                  className="h-11 w-32 bg-transparent text-right text-[15px] outline-none"
                />
              </span>
              <span className="text-[12px] text-tenue">Total {formatearCOP(f.fijos + (valores[f.id] ?? 0))}</span>
            </label>
          </div>
        ))}
      </div>
      <div className="z-10 flex flex-wrap items-center gap-3 rounded-xl bg-seleccion px-4 py-3.5 lg:sticky lg:bottom-2">
        <span className="min-w-0 flex-[1_1_220px]">
          <span className="block text-[12px] text-cuerpo">Presupuesto mensual</span>
          <b className="text-xl">{formatearCOP(fijos + variable)}</b>
          <span className="block text-[13px] text-cuerpo">
            Fijos {formatearCOP(fijos)} + variable {formatearCOP(variable)} · esenciales {formatearCOP(esencial)}
          </span>
        </span>
        <span className="flex flex-wrap gap-2">
          {cancelar}
          <BotonEnviar pendiente="Guardando…">Guardar presupuesto</BotonEnviar>
        </span>
      </div>
    </form>
  );
}
