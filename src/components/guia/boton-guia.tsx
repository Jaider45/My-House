"use client";

import { clasesBoton, type estilosBoton } from "@/components/ui";
import { EVENTO_GUIA, type IdGuia } from "@/lib/guias";

/** Inicia una guía interactiva (la escucha `MotorGuia`, que vive en el layout). */
export function BotonGuia({
  id,
  children = "¿Cómo se usa?",
  variante = "secundario",
  className,
}: {
  id: IdGuia;
  children?: React.ReactNode;
  variante?: keyof typeof estilosBoton;
  className?: string;
}) {
  return (
    <button type="button" className={clasesBoton(variante, className)} onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_GUIA, { detail: id }))}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
      </svg>
      {children}
    </button>
  );
}
