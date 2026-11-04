"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { guardarHogar } from "../acciones";

export function FormularioHogar({ nombre, cuota, editable }: { nombre: string; cuota: number; editable: boolean }) {
  const [estado, accion] = useActionState(guardarHogar, null);
  return (
    <form action={accion} className="space-y-4">
      <fieldset disabled={!editable} className="space-y-4">
        <Campo etiqueta="Nombre del hogar" name="nombre" defaultValue={nombre} required maxLength={80} />
        <Campo
          etiqueta="Cuota de imprevistos (%)"
          name="cuota"
          type="number"
          inputMode="numeric"
          min={0}
          max={50}
          defaultValue={cuota}
          required
          ayuda="Se suma al número mínimo del hogar como colchón: porcentaje sobre fijos + variables esenciales."
        />
      </fieldset>
      <MensajeEstado estado={estado} />
      {editable && <BotonEnviar className="w-full">Guardar</BotonEnviar>}
    </form>
  );
}
