"use client";

import { useFormStatus } from "react-dom";
import { Boton } from ".";
import type { ComponentProps } from "react";

export function BotonEnviar({ children, pendiente = "Guardando…", ...props }: ComponentProps<typeof Boton> & { pendiente?: string }) {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendiente : children}
    </Boton>
  );
}
