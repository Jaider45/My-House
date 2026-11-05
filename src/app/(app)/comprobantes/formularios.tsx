"use client";

import { useActionState } from "react";
import { Casilla, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { Campo } from "@/components/ui";
import { resolverComprobante } from "./acciones";

type Opcion = { id: string; etiqueta: string };

/** Completa lo que el asistente no pudo leer y lo registra. */
export function FormularioResolver({
  id,
  monto,
  fecha,
  categoria,
  cuenta,
  categorias,
  cuentas,
  hoy,
}: {
  id: string;
  monto: number | null;
  fecha: string | null;
  categoria: string | null;
  cuenta: string | null;
  categorias: Opcion[];
  cuentas: Opcion[];
  hoy: string;
}) {
  const [estado, accion] = useActionState(resolverComprobante, null);
  return (
    <form action={accion} className="mt-2.5 flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Selector etiqueta="Categoría" name="category_id" defaultValue={categoria ?? ""}>
          <option value="">Elige…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Cuenta" name="account_id" defaultValue={cuenta ?? cuentas[0]?.id}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </Selector>
        <CampoMonto etiqueta="Total" name="monto" valorInicial={monto ?? 0} />
        <Campo etiqueta="Fecha" name="fecha" type="date" defaultValue={fecha ?? hoy} max={hoy} />
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold text-cuerpo">¿Personal o del negocio?</legend>
        {(["personal", "negocio"] as const).map((a) => (
          <label
            key={a}
            className="inline-flex h-9 cursor-pointer items-center rounded-full border border-control bg-elevada px-3 text-sm has-[:checked]:border-monte has-[:checked]:bg-monte has-[:checked]:text-arena"
          >
            <input type="radio" name="ambito" value={a} defaultChecked={a === "personal"} className="sr-only" />
            {a === "personal" ? "Personal" : "Negocio"}
          </label>
        ))}
      </fieldset>
      <Casilla etiqueta="Recordar la categoría para este comercio" name="aprender" defaultChecked />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="self-start">Registrar</BotonEnviar>
    </form>
  );
}
