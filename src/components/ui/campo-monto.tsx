"use client";

import { useState, type ComponentProps } from "react";
import { digitosAMonto, formatearMiles } from "@/lib/dinero";

type Props = Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "name"> & {
  etiqueta: string;
  name: string;
  valorInicial?: number;
  ayuda?: string;
  grande?: boolean;
  onCambio?: (pesos: number) => void;
};

/** Monto en pesos: muestra "1.234.567" mientras se escribe y envía el entero en un input oculto. */
export function CampoMonto({ etiqueta, name, valorInicial = 0, ayuda, grande, onCambio, className, ...props }: Props) {
  const [pesos, setPesos] = useState(Math.abs(valorInicial));
  return (
    <label className={`block space-y-1 ${className ?? ""}`}>
      <span className="text-sm font-medium">{etiqueta}</span>
      <span className="flex items-center rounded-xl border border-zinc-300 bg-white px-3 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900">
        <span className={`text-zinc-500 ${grande ? "text-2xl" : ""}`}>$</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          className={`w-full bg-transparent px-2 outline-none ${grande ? "min-h-16 text-4xl font-bold" : "min-h-11 text-base"}`}
          value={pesos ? formatearMiles(pesos) : ""}
          onChange={(e) => {
            const valor = digitosAMonto(e.target.value);
            setPesos(valor);
            onCambio?.(valor);
          }}
          placeholder="0"
          {...props}
        />
      </span>
      <input type="hidden" name={name} value={pesos} />
      {ayuda && <span className="block text-xs text-zinc-500">{ayuda}</span>}
    </label>
  );
}
