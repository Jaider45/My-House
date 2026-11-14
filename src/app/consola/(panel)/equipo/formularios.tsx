"use client";

import { useActionState } from "react";
import { AreaTexto, Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { Conmutador } from "@/components/ui/interruptor";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { PERMISOS, type Permiso } from "@/lib/consola/permisos";
import { guardarInactividad, guardarMiCelular, guardarRol } from "./acciones";

export type RolPropio = { id: string; nombre: string; descripcion: string; permisos: Permiso[]; personas: number };

/** «Nuevo rol» o editar uno propio: nombre, para qué es y qué permisos de la matriz tiene. */
export function FormularioRol({ rol }: { rol?: RolPropio }) {
  const [estado, enviar] = useActionState(guardarRol, null);
  const [estadoBorrar, borrar] = useActionState(guardarRol, null);
  useCerrarAlGuardar(estado);
  useCerrarAlGuardar(estadoBorrar);
  return (
    <>
      <form action={enviar} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={rol?.id ?? ""} />
        <Campo etiqueta="Nombre del rol" name="nombre" defaultValue={rol?.nombre} required minLength={2} maxLength={40} placeholder="Analista de datos" />
        <AreaTexto etiqueta="Para qué es (opcional)" name="descripcion" defaultValue={rol?.descripcion} maxLength={200} rows={2} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-cuerpo">Permisos</legend>
          {PERMISOS.map((p) => (
            <label key={p.valor} className="inline-flex items-start gap-2 text-sm">
              <input type="checkbox" name="permisos" value={p.valor} defaultChecked={rol?.permisos.includes(p.valor)} className="mt-0.5 size-4 shrink-0 accent-monte" />
              <span>
                {p.texto}
                {p.valor === "equipo" && <span className="block text-[13px] text-tenue">Puede invitar, cambiar roles y las políticas de acceso: dalo con cuidado.</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-[13px] text-tenue">Ver los datos financieros de un hogar siempre exige además el permiso de su administrador.</p>
        <MensajeEstado estado={estado} />
        <PieVentana>{rol ? "Guardar rol" : "Crear rol"}</PieVentana>
      </form>
      {rol && (
        <form action={borrar} className="mt-3 border-t border-divisor pt-3">
          <input type="hidden" name="id" value={rol.id} />
          <input type="hidden" name="borrar" value="1" />
          <button type="submit" disabled={rol.personas > 0} className="text-sm font-semibold text-error-tinta hover:underline disabled:text-tenue disabled:no-underline">
            {rol.personas > 0 ? `No se puede borrar: ${rol.personas} ${rol.personas === 1 ? "persona lo tiene" : "personas lo tienen"}` : "Borrar rol"}
          </button>
          <MensajeEstado estado={estadoBorrar} />
        </form>
      )}
    </>
  );
}

/** Política «Cerrar sesión por inactividad». */
export function FormularioInactividad({ minutos }: { minutos: number }) {
  const [estado, enviar] = useActionState(guardarInactividad, null);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2 py-2">
      <Selector etiqueta="Cerrar sesión por inactividad" name="minutos" defaultValue={String(minutos)} className="min-w-[180px] flex-1">
        {[15, 30, 60, 120, 240].map((m) => (
          <option key={m} value={m}>
            {m < 60 ? `${m} min` : `${m / 60} ${m === 60 ? "hora" : "horas"}`}
          </option>
        ))}
      </Selector>
      <BotonEnviar variante="secundario" className="h-11 px-3 text-sm" pendiente="…">
        Guardar
      </BotonEnviar>
      <div className="w-full">
        <MensajeEstado estado={estado} />
      </div>
    </form>
  );
}

/** Tu celular para los avisos del equipo por WhatsApp (Ajustes → Avisos para el equipo). */
export function FormularioMiCelular({ telefono, whatsapp }: { telefono: string | null; whatsapp: boolean }) {
  const [estado, enviar] = useActionState(guardarMiCelular, null);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Campo etiqueta="Celular" name="telefono" type="tel" inputMode="tel" defaultValue={telefono ?? ""} placeholder="+57 300 123 4567" autoComplete="tel" />
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>Recibir los avisos del equipo por WhatsApp</span>
        <Conmutador name="whatsapp" defaultChecked={whatsapp} etiqueta="Recibir los avisos del equipo por WhatsApp" />
      </div>
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="secundario" pendiente="Guardando…">
        Guardar celular
      </BotonEnviar>
    </form>
  );
}
