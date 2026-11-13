"use client";

/** Abre el diálogo de impresión (ahí se elige «Guardar como PDF»). */
export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center rounded-[10px] bg-monte px-4 text-[15px] font-semibold text-arena print:hidden">
      Imprimir o guardar en PDF
    </button>
  );
}
