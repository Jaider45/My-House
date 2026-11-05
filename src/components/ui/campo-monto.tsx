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
    <label className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[13px] leading-[18px] font-semibold text-cuerpo">{etiqueta}</span>
      <span
        className={`flex items-center rounded-lg bg-elevada px-3 focus-within:ring-2 focus-within:ring-teja focus-within:ring-offset-2 ${
          grande ? "border-2 border-monte" : "border border-control"
        }`}
      >
        <span className={grande ? "text-[32px] font-bold text-cuerpo" : "text-cuerpo"}>$</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          className={`w-full bg-transparent px-2 outline-none ${grande ? "h-16 text-[32px] font-bold" : "h-11 text-[15px]"}`}
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
      {ayuda && <span className="text-[13px] leading-[18px] text-tenue">{ayuda}</span>}
    </label>
  );
}
