"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

/** Repaso rápido de una lección: una pregunta con tres opciones y la respuesta al tocar. */
export function Repaso({ pregunta, opciones, correcta, bien, mal }: { pregunta: string; opciones: string[]; correcta: number; bien: string; mal: string }) {
  const [elegida, setElegida] = useState<number | null>(null);
  return (
    <section aria-label="Repaso rápido" className="flex flex-col gap-2.5 rounded-2xl border border-borde bg-elevada p-5">
      <b className="text-[17px]">Repaso rápido</b>
      <span className="text-cuerpo">{pregunta}</span>
      {opciones.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => setElegida(i)}
          aria-pressed={elegida === i}
          className={cx(
            "flex min-h-12 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[15px]",
            elegida === i ? (i === correcta ? "border-ok bg-ok-fondo font-bold text-ok-tinta" : "border-error bg-error-fondo text-error-tinta") : "border-control bg-elevada hover:bg-mosaico",
          )}
        >
          {o}
        </button>
      ))}
      {elegida !== null && (
        <span role="status" className="text-sm text-cuerpo">
          {elegida === correcta ? bien : mal}
        </span>
      )}
    </section>
  );
}
