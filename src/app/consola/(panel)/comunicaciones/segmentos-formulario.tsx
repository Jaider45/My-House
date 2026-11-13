"use client";

import { useActionState, useRef } from "react";
import { Campo, Selector } from "@/components/ui";
import { MensajeEstado } from "@/components/ui/estado";
import { Conmutador } from "@/components/ui/interruptor";
import { PieVentana, Ventana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { cambiarAutomatico, guardarSegmento } from "./editor-acciones";

export type SegmentoPropio = { id: string; nombre: string; plan: string; condiciones: string[]; actividad: string; hogares: number; con_permiso: number; personas: number };

export const CONDICIONES_SEGMENTO: [string, string][] = [
  ["tope_dian", "Alguien del hogar pasó un tope DIAN"],
  ["presupuesto_excedido", "Una categoría pasó su presupuesto este mes"],
  ["fondo_atrasado", "El fondo de emergencia va atrasado"],
  ["sin_fondo", "No tiene fondo de emergencia"],
  ["varias_deudas", "Tiene más de una deuda"],
  ["un_miembro_14d", "Un solo miembro hace 14 días (sin pareja invitada)"],
  ["sin_registro_7d", "No registra nada en 7 días"],
];

function FormSegmento({ s }: { s?: SegmentoPropio }) {
  const [estado, enviar] = useActionState(guardarSegmento, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={s?.id ?? ""} />
      <Campo etiqueta="Nombre" name="nombre" defaultValue={s?.nombre} required maxLength={60} placeholder="Obligados a declarar renta" />
      <div className="grid gap-3 md:grid-cols-2">
        <Selector etiqueta="Plan" name="plan" defaultValue={s?.plan ?? "todos"}>
          <option value="todos">Todos los planes</option>
          <option value="gratis">Gratis</option>
          <option value="familia">Familia</option>
          <option value="contador">Contador</option>
          <option value="pago">Cualquier plan pago</option>
          <option value="prueba">Probando Familia</option>
        </Selector>
        <Selector etiqueta="Actividad" name="actividad" defaultValue={s?.actividad ?? "cualquiera"}>
          <option value="cualquiera">Cualquiera</option>
          <option value="activos">Registró algo en 30 días</option>
          <option value="inactivos">Sin movimientos en 30 días</option>
        </Selector>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-semibold text-cuerpo">Y además (todas las que marques)</legend>
        {CONDICIONES_SEGMENTO.map(([k, t]) => (
          <label key={k} className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="condiciones" value={k} defaultChecked={s?.condiciones.includes(k)} className="size-4 accent-monte" />
            {t}
          </label>
        ))}
      </fieldset>
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar segmento</PieVentana>
    </form>
  );
}

function BorrarSegmento({ id }: { id: string }) {
  const [estado, enviar] = useActionState(guardarSegmento, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="mt-2 border-t border-divisor pt-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="borrar" value="1" />
      <button type="submit" className="text-sm font-semibold text-error-tinta hover:underline">
        Borrar segmento
      </button>
      <MensajeEstado estado={estado} />
    </form>
  );
}

export function VentanasSegmentos({ segmentos }: { segmentos: SegmentoPropio[] }) {
  return (
    <>
      <Ventana titulo="Nuevo segmento" valor="segmento" ancho={600}>
        <FormSegmento />
      </Ventana>
      {segmentos.map((s) => (
        <Ventana key={s.id} titulo="Editar segmento" valor={`segmento-${s.id}`} ancho={600}>
          <FormSegmento s={s} />
          <BorrarSegmento id={s.id} />
        </Ventana>
      ))}
    </>
  );
}

/** Encender o apagar un correo automático desde la tabla (guarda al tocar). */
export function InterruptorAutomatico({ clave, activo }: { clave: string; activo: boolean }) {
  const [estado, enviar] = useActionState(cambiarAutomatico, null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={enviar} className="inline-flex items-center gap-2">
      <input type="hidden" name="clave" value={clave} />
      <Conmutador name="activo" defaultChecked={activo} etiqueta="Correo activo" alCambiar={() => setTimeout(() => form.current?.requestSubmit(), 0)} />
      {estado?.error && <span className="text-xs text-error-tinta">{estado.error}</span>}
    </form>
  );
}
