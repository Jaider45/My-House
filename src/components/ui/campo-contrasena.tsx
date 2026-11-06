"use client";

import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { claseControl, cx } from ".";
import { evaluarContrasena, MINIMO_CONTRASENA } from "@/lib/contrasena";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  etiqueta: string;
  ayuda?: string;
  /** Muestra la fuerza de la contraseña mientras se escribe (registro y cambio de contraseña). */
  medidor?: boolean;
  onCambio?: (valor: string) => void;
};

const COLOR_NIVEL = ["bg-pista", "bg-error", "bg-alerta", "bg-ok"] as const;
const TINTA_NIVEL = ["text-tenue", "text-error-tinta", "text-alerta-tinta", "text-ok-tinta"] as const;

/**
 * Campo de contraseña con botón para verla, aviso de Bloq Mayús y medidor opcional. El valor vive en el
 * componente: React vacía los campos no controlados tras cada acción, y así un error no borra lo escrito.
 */
export function CampoContrasena({ etiqueta, ayuda, medidor, onCambio, className, id, minLength = MINIMO_CONTRASENA, ...props }: Props) {
  const propio = useId();
  const idCampo = id ?? propio;
  const idAyuda = `${idCampo}-ayuda`;
  const [valor, setValor] = useState("");
  const [visible, setVisible] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // Al enviar se vuelve a ocultar: así el navegador ofrece guardarla y no queda a la vista en la pantalla siguiente.
  useEffect(() => {
    const form = campo.current?.form;
    if (!form) return;
    const ocultar = () => setVisible(false);
    form.addEventListener("submit", ocultar);
    return () => form.removeEventListener("submit", ocultar);
  }, []);

  const revisarMayusculas = (e: KeyboardEvent<HTMLInputElement>) => setMayusculas(e.getModifierState?.("CapsLock") ?? false);
  const fuerza = evaluarContrasena(valor);

  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={idCampo} className="text-[13px] leading-[18px] font-semibold text-cuerpo">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          ref={campo}
          id={idCampo}
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            onCambio?.(e.target.value);
          }}
          onKeyDown={revisarMayusculas}
          onKeyUp={revisarMayusculas}
          onBlur={() => setMayusculas(false)}
          minLength={minLength}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={ayuda || medidor || mayusculas ? idAyuda : undefined}
          className={cx(claseControl, "pr-12")}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Sin robar el foco: se puede seguir escribiendo después de tocar el ojo.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          aria-controls={idCampo}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-cuerpo hover:text-tinta"
        >
          <Ojo tachado={visible} />
        </button>
      </div>
      <div id={idAyuda} aria-live="polite" className="flex flex-col gap-1.5 empty:hidden">
        {mayusculas && <span className="text-[13px] leading-[18px] font-semibold text-alerta-tinta">Bloq Mayús está activado.</span>}
        {medidor && (
          <span className="flex flex-col gap-1.5">
            <span className="grid grid-cols-3 gap-1" aria-hidden>
              {[1, 2, 3].map((n) => (
                <span key={n} className={cx("h-1 rounded-full transition-colors", fuerza.nivel >= n ? COLOR_NIVEL[fuerza.nivel] : "bg-pista")} />
              ))}
            </span>
            <span className="text-[13px] leading-[18px] text-tenue">
              {valor && <strong className={cx("font-semibold", TINTA_NIVEL[fuerza.nivel])}>{fuerza.etiqueta}. </strong>}
              {fuerza.consejo || "Buena elección."}
            </span>
          </span>
        )}
        {ayuda && !medidor && <span className="text-[13px] leading-[18px] text-tenue">{ayuda}</span>}
      </div>
    </div>
  );
}

/** Ojo con el trazo de la marca (1.75, puntas redondeadas); tachado cuando la contraseña está a la vista. */
function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <path d="M4 4l16 16" stroke="var(--color-teja)" />}
    </svg>
  );
}
