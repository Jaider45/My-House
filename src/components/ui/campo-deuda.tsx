"use client";

import { formatearCOP } from "@/lib/dinero";

export type OpcionDeuda = { id: string; nombre: string; cuota: number | null };

/**
 * «¿Qué deuda estás pagando?» (cuando la categoría es Deudas): el pago queda como abono de esa deuda y, si tenía la
 * cuota pendiente como pago fijo, la confirma en vez de duplicarla. Envía `debt_id`.
 */
export function CampoDeuda({ deudas, valor, onCambio }: { deudas: OpcionDeuda[]; valor: string; onCambio: (deuda: OpcionDeuda | null) => void }) {
  if (!deudas.length) return null;
  const chip = (activo: boolean) =>
    `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-left text-sm font-semibold transition ${
      activo ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico"
    }`;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] leading-[18px] font-semibold text-cuerpo">¿Qué deuda estás pagando?</legend>
      <input type="hidden" name="debt_id" value={valor} />
      <div className="flex flex-wrap gap-2">
        {deudas.map((d) => (
          <button key={d.id} type="button" className={chip(valor === d.id)} aria-pressed={valor === d.id} onClick={() => onCambio(valor === d.id ? null : d)}>
            {d.nombre}
            {d.cuota ? <span className={`font-normal ${valor === d.id ? "text-arena/80" : "text-cuerpo"}`}>· cuota {formatearCOP(d.cuota)}</span> : null}
          </button>
        ))}
        <button type="button" className={chip(!valor)} aria-pressed={!valor} onClick={() => onCambio(null)}>
          Ninguna
        </button>
      </div>
      <span className="text-[13px] text-tenue">Cuenta como abono y, si la cuota estaba pendiente, la marca como pagada sin duplicarla.</span>
    </fieldset>
  );
}
