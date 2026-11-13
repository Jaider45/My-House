"use client";

import { clasesBoton, type estilosBoton } from "@/components/ui";
import { EVENTO_GUIA, type IdGuia } from "@/lib/guias";

/**
 * Inicia una guía interactiva (la escucha `MotorGuia`, que vive en el layout). En los encabezados (`compacto`) en
 * celular queda solo el ícono de pregunta, para no competir con el título; el nombre sigue para lectores de pantalla.
 */
export function BotonGuia({
  id,
  children = "¿Cómo se usa?",
  variante = "fantasma",
  className,
  compacto = true,
}: {
  id: IdGuia;
  children?: React.ReactNode;
  variante?: keyof typeof estilosBoton;
  className?: string;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      data-guia-boton={id}
      className={clasesBoton(variante, compacto ? `max-md:w-10 max-md:px-0 ${className ?? ""}` : className)}
      onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_GUIA, { detail: id }))}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
      </svg>
      <span className={compacto ? "max-md:sr-only" : undefined}>{children}</span>
    </button>
  );
}
