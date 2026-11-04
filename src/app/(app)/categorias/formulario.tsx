"use client";

import { useActionState } from "react";
import { Campo, Casilla, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import type { Categoria } from "@/lib/categorias";
import { eliminarCategoria, guardarCategoria } from "./acciones";

type Props = {
  categoria?: Categoria;
  /** Para crear: clase y, si es subcategoría, su padre (hereda tipo y esencial). */
  clase: Categoria["clase"];
  padre?: Categoria;
};

export function FormularioCategoria({ categoria, clase, padre }: Props) {
  const [estado, accion] = useActionState(guardarCategoria, null);
  const base = categoria ?? padre;
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={categoria?.id ?? ""} />
      <input type="hidden" name="padre_id" value={padre?.id ?? ""} />
      <input type="hidden" name="clase" value={clase} />
      <Campo
        etiqueta={padre ? `Nueva subcategoría de ${padre.nombre}` : "Nombre"}
        name="nombre"
        defaultValue={categoria?.nombre}
        required
        maxLength={60}
      />
      <Selector etiqueta="Tipo" name="tipo" defaultValue={base?.tipo ?? "variable"}>
        <option value="fijo">Fijo: mismo valor cada mes</option>
        <option value="variable">Variable: cambia mes a mes</option>
      </Selector>
      {clase === "gasto" && (
        <>
          <Casilla etiqueta="Esencial (cuenta para el número mínimo del hogar)" name="es_esencial" defaultChecked={base?.es_esencial} />
          <Casilla
            etiqueta="No cuenta como costo de vida (ahorro, inversión)"
            name="excluir_de_costo_vida"
            defaultChecked={base?.excluir_de_costo_vida}
          />
        </>
      )}
      <MensajeEstado estado={estado} />
      <BotonEnviar variante={categoria ? "primario" : "secundario"} className="w-full">
        {categoria ? "Guardar" : "Agregar"}
      </BotonEnviar>
    </form>
  );
}

export function BotonEliminarCategoria({ id }: { id: string }) {
  const [estado, accion] = useActionState(eliminarCategoria, null);
  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="peligro" pendiente="Eliminando…" className="w-full">
        Eliminar
      </BotonEnviar>
    </form>
  );
}
