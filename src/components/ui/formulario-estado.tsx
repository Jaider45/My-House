"use client";

import { useActionState, type ComponentProps } from "react";
import { MensajeEstado } from "@/components/ui/estado";
import type { Estado } from "@/lib/acciones";

/** Formulario que muestra el resultado (listo o error) bajo los campos. */
export function FormularioEstado({
  accion,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action"> & { accion: (estado: Estado, datos: FormData) => Promise<Estado> }) {
  const [estado, enviar] = useActionState(accion, null);
  return (
    <form action={enviar} {...props}>
      {children}
      <MensajeEstado estado={estado} />
    </form>
  );
}
