"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Chip, CuadroIcono, Explicacion, claseControl, cx } from "@/components/ui";
import { PieVentana } from "@/components/ui/ventana";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
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
  const [estado, accion] = useActionState(guardarPresupuesto, null);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="mes" value={mes} />
      <p className="text-sm text-cuerpo">
        Los <b>pagos fijos</b> (arriendo, colegio, servicios…) ya cuentan solos: agrégalos o cámbialos en Pagos → Pagos
        fijos. Aquí escribe cuánto planeas gastar <b>además</b> en cada categoría (mercado, transporte, salidas…). Se repite
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
                  // Solo se envían las categorías que cambiaron: menos trabajo en la base.
                  name={valores[f.id] !== f.variable ? `adicional:${f.id}` : undefined}
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
      <MensajeEstado estado={estado} />
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

export type CategoriaPresupuesto = { id: string; nombre: string; variable: number; fijos: number; promedio3: number };

/**
 * «Agregar presupuesto» (ventana): una categoría y cuánto gastar al mes además de sus pagos fijos, con las
 * sugerencias del diseño a partir del promedio de los últimos 3 meses. Usa la misma acción que la edición completa.
 */
export function FormularioAgregarPresupuesto({ categorias, mes, totalActual }: { categorias: CategoriaPresupuesto[]; mes: string; totalActual: number }) {
  const [id, setId] = useState(categorias.find((c) => !c.variable)?.id ?? categorias[0]?.id ?? "");
  const cat = categorias.find((c) => c.id === id);
  const [monto, setMonto] = useState(cat?.variable ?? 0);
  const [estado, accion] = useActionState(guardarPresupuesto, null);
  const redondo = (n: number) => Math.round(n / 1000) * 1000;
  const base = cat ? Math.max(0, cat.promedio3 - cat.fijos) : 0;
  const sugerencias = base
    ? [
        { texto: "Promedio", valor: redondo(base) },
        { texto: "Un poco más", valor: redondo(base * 1.1) },
        { texto: "Ahorrar 10 %", valor: redondo(base * 0.9) },
      ]
    : [];
  const quedaria = totalActual - (cat?.variable ?? 0) + monto;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="mes" value={mes} />
      {id && <input type="hidden" name={`adicional:${id}`} value={monto} />}
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[13px] leading-[18px] font-semibold text-cuerpo">Categoría</span>
        <select
          className={claseControl}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setMonto(categorias.find((c) => c.id === e.target.value)?.variable ?? 0);
          }}
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.variable ? ` · hoy ${formatearCOP(c.variable)}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[13px] leading-[18px] font-semibold text-cuerpo">Monto al mes</span>
        <span className="flex items-center rounded-lg border border-control bg-elevada px-3 focus-within:ring-2 focus-within:ring-teja focus-within:ring-offset-2">
          <span className="text-cuerpo">$</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            className="h-11 w-full bg-transparent px-2 text-[15px] outline-none"
            value={monto ? formatearMiles(monto) : ""}
            onChange={(e) => setMonto(digitosAMonto(e.target.value))}
            placeholder="0"
          />
        </span>
        {!!cat?.fijos && <span className="text-[13px] text-tenue">Además de sus pagos fijos ({formatearCOP(cat.fijos)}), que ya cuentan solos.</span>}
      </label>
      {sugerencias.length > 0 && (
        <div data-guia="sugerencias" className="flex flex-col gap-2">
          <span className="text-[13px] leading-[18px] font-semibold text-cuerpo">Sugerencias según tus últimos 3 meses</span>
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((g) => (
              <button
                key={g.texto}
                type="button"
                onClick={() => setMonto(g.valor)}
                aria-pressed={monto === g.valor}
                className={cx(
                  "inline-flex h-9 items-center rounded-full border px-3 text-sm",
                  monto === g.valor ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico",
                )}
              >
                {g.texto} · {formatearCOP(g.valor)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div data-guia="quedaria">
      <Explicacion>
        Tu presupuesto del mes quedaría en <b>{formatearCOP(quedaria)}</b>. Se repite cada mes; puedes ajustarlo cuando quieras.
      </Explicacion>
      </div>
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar presupuesto</PieVentana>
    </form>
  );
}
