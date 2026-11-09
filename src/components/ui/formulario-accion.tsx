"use client";

import { useActionState, type ComponentProps } from "react";
import { cx } from ".";
import type { Estado } from "@/lib/acciones";

/**
 * Formulario de una sola acción (archivar, eliminar, confirmar…) que muestra el error que devuelve la acción.
 * Permite usar acciones con estado desde páginas de servidor sin volverlas de cliente. Si la acción redirige,
 * la navegación ocurre igual (la acción se pasa tal cual a `useActionState`, sin envolverla).
 */
export function FormularioAccion({
  accion,
  children,
  className,
  ...props
}: Omit<ComponentProps<"form">, "action"> & { accion: (estado: Estado, datos: FormData) => Promise<Estado> }) {
  const [estado, enviar] = useActionState(accion, null);
  return (
    <form action={enviar} className={cx(className, estado?.error && "flex-wrap")} {...props}>
      {children}
      {estado?.error && (
        <p role="alert" className="basis-full text-[13px] font-semibold text-error-tinta">
          {estado.error}
        </p>
      )}
    </form>
  );
}
