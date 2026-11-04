"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { crearHogar } from "./acciones";

export function FormularioHogar({ nombre }: { nombre: string }) {
  const [estado, accion] = useActionState(crearHogar, null);
  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Nombre del hogar" name="hogar" placeholder="Familia Pérez" required maxLength={80} autoFocus />
      <Campo etiqueta="Su nombre" name="nombre" defaultValue={nombre} required maxLength={80} />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="w-full" pendiente="Creando…">
        Crear hogar
      </BotonEnviar>
    </form>
  );
}
