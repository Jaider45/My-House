"use client";

import { useId, useState, type ReactNode } from "react";
import { cx } from ".";

/** El interruptor visual (switch) del diseño. */
export function Palanca({ activo, className }: { activo: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("relative inline-block h-[26px] w-11 shrink-0 rounded-full border transition", activo ? "border-monte bg-monte" : "border-control bg-pista", className)}>
      <span className={cx("absolute top-0.5 size-5 rounded-full bg-white transition-all", activo ? "left-5" : "left-0.5 shadow-[0_0_0_1px_var(--color-control)]")} />
    </span>
  );
}

/**
 * Opción sí/no dentro de un formulario (caja arena con título, detalle e interruptor, como en «Crear»). Envía
 * `name=1` si está activa y `name=0` si no. `alCambiar` sirve para mostrar u ocultar campos que dependen de ella.
 */
export function Interruptor({
  name,
  titulo,
  texto,
  defaultChecked = false,
  alCambiar,
  children,
  guia,
}: {
  name: string;
  titulo: string;
  texto?: ReactNode;
  defaultChecked?: boolean;
  alCambiar?: (activo: boolean) => void;
  /** Campos que aparecen cuando está activa (dentro de la misma caja). */
  children?: ReactNode;
  guia?: string;
}) {
  const [activo, setActivo] = useState(defaultChecked);
  const id = useId();
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[#f6efe6] p-3.5" data-guia={guia}>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm leading-5">
          <b id={`${id}-t`}>{titulo}</b>
          {texto && (
            <>
              <br />
              <span className="text-cuerpo">{texto}</span>
            </>
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-labelledby={`${id}-t`}
          onClick={() => {
            setActivo(!activo);
            alCambiar?.(!activo);
          }}
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monte"
        >
          <Palanca activo={activo} />
        </button>
        <input type="hidden" name={name} value={activo ? "1" : "0"} />
      </div>
      {activo && children}
    </div>
  );
}
