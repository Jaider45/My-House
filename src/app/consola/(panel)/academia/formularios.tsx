"use client";

import { useActionState, useRef } from "react";
import { AreaTexto, Campo, Selector } from "@/components/ui";
import { MensajeEstado } from "@/components/ui/estado";
import { Conmutador, Interruptor } from "@/components/ui/interruptor";
import { PieVentana, Ventana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { TEMAS } from "@/lib/academia";
import { guardarRecomendacion, guardarRuta, guardarTaller } from "./acciones";

export type RutaConsola = { slug: string; titulo: string; portada: string; descripcion: string; tema: string; icono: string; color: string; publicada: boolean };
export type Recomendacion = { id: string; condicion: string; ruta: string; leccion: string | null; lugares: string[]; activa: boolean; clics: number };
export type TallerConsola = { id: string; titulo: string; descripcion: string; fecha: string; enlace: string | null; cupos: number; publicado: boolean; inscritos: number };

export const CONDICIONES: [string, string][] = [
  ["presupuesto_excedido", "Una categoría pasa su presupuesto"],
  ["tope_dian", "Alguien pasa un tope DIAN"],
  ["fondo_atrasado", "El fondo de emergencia va atrasado"],
  ["sin_fondo", "No tiene fondo de emergencia"],
  ["varias_deudas", "Tiene más de una deuda"],
  ["un_miembro_14d", "Hogar con un solo miembro por 14 días"],
  ["sin_registro_7d", "No registra nada en 7 días"],
  ["siempre", "Siempre (para empezar)"],
];
export const LUGARES: [string, string][] = [
  ["academia", "Academia"],
  ["inicio", "Inicio"],
  ["presupuesto", "Presupuesto"],
  ["renta", "Renta DIAN"],
  ["metas", "Metas"],
];
const ICONOS = ["resumen", "casa", "familia", "ahorro", "declaracion-renta", "deducciones", "egresos", "meta", "educacion", "cuentas"];

function FormRuta({ r }: { r?: RutaConsola }) {
  const [estado, enviar] = useActionState(guardarRuta, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="slug_previo" value={r?.slug ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Título" name="titulo" defaultValue={r?.titulo} required maxLength={80} />
        <Campo etiqueta="Dirección (/academia/…)" name="slug" defaultValue={r?.slug} placeholder="se arma del título" maxLength={40} />
      </div>
      <Campo etiqueta="Texto de la portada" name="portada" defaultValue={r?.portada} maxLength={60} />
      <AreaTexto etiqueta="Descripción" name="descripcion" defaultValue={r?.descripcion} maxLength={240} rows={2} />
      <div className="grid gap-3 md:grid-cols-3">
        <Selector etiqueta="Tema" name="tema" defaultValue={r?.tema ?? "finanzas"}>
          {Object.entries(TEMAS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Ícono" name="icono" defaultValue={r?.icono ?? "resumen"}>
          {ICONOS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </Selector>
        <Selector etiqueta="Color" name="color" defaultValue={r?.color ?? "monte"}>
          {["monte", "teja", "mar", "arena"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Selector>
      </div>
      <Interruptor name="publicada" titulo="Publicada" texto="Se ve en la Academia cuando tiene al menos una lección publicada." defaultChecked={r?.publicada ?? false} />
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar ruta</PieVentana>
    </form>
  );
}

function FormRecomendacion({ r, destinos }: { r?: Recomendacion; destinos: [string, string][] }) {
  const [estado, enviar] = useActionState(guardarRecomendacion, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={r?.id ?? ""} />
      <Selector etiqueta="Si pasa esto en el hogar" name="condicion" defaultValue={r?.condicion ?? "presupuesto_excedido"}>
        {CONDICIONES.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Recomendar" name="destino" defaultValue={r ? `${r.ruta}${r.leccion ? `/${r.leccion}` : ""}` : ""}>
        <option value="">Elige una ruta o lección</option>
        {destinos.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Selector>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[13px] font-semibold text-cuerpo">Dónde aparece</legend>
        <span className="flex flex-wrap gap-x-4 gap-y-2">
          {LUGARES.map(([k, v]) => (
            <label key={k} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="lugares" value={k} defaultChecked={r ? r.lugares.includes(k) : k === "academia"} className="size-4 accent-monte" />
              {v}
            </label>
          ))}
        </span>
      </fieldset>
      <Interruptor name="activa" titulo="Activa" defaultChecked={r?.activa ?? true} />
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar regla</PieVentana>
    </form>
  );
}

function FormTaller({ t }: { t?: TallerConsola }) {
  const [estado, enviar] = useActionState(guardarTaller, null);
  useCerrarAlGuardar(estado);
  const local = t ? new Date(new Date(t.fecha).getTime() - 5 * 3600_000).toISOString().slice(0, 16) : "";
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={t?.id ?? ""} />
      <Campo etiqueta="Taller" name="titulo" defaultValue={t?.titulo} required maxLength={100} placeholder="Arma tu presupuesto 2027 en pareja" />
      <AreaTexto etiqueta="De qué se trata" name="descripcion" defaultValue={t?.descripcion} maxLength={500} rows={3} />
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Fecha y hora (Bogotá)" name="fecha" type="datetime-local" defaultValue={local} required />
        <Campo etiqueta="Cupos" name="cupos" type="number" min={1} max={10000} defaultValue={t?.cupos ?? 100} />
      </div>
      <Campo etiqueta="Enlace de la sesión (Zoom, Meet…)" name="enlace" defaultValue={t?.enlace ?? ""} placeholder="https://…" />
      <Interruptor name="publicado" titulo="Inscripciones abiertas" texto="Aparece en la Academia; el enlace solo lo ven quienes se inscriben." defaultChecked={t?.publicado ?? false} />
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar taller</PieVentana>
    </form>
  );
}

/** Interruptor de una regla directo en la tabla (guarda al tocar). */
export function ActivarRegla({ r }: { r: Recomendacion }) {
  const [estado, enviar] = useActionState(guardarRecomendacion, null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={enviar} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="condicion" value={r.condicion} />
      <input type="hidden" name="destino" value={`${r.ruta}${r.leccion ? `/${r.leccion}` : ""}`} />
      {r.lugares.map((l) => (
        <input key={l} type="hidden" name="lugares" value={l} />
      ))}
      <Conmutador name="activa" defaultChecked={r.activa} etiqueta="Regla activa" alCambiar={() => setTimeout(() => form.current?.requestSubmit(), 0)} />
      {estado?.error && <span className="text-xs text-error-tinta">{estado.error}</span>}
    </form>
  );
}

export function VentanasAcademia({ rutas, recomendaciones, talleres, destinos }: { rutas: RutaConsola[]; recomendaciones: Recomendacion[]; talleres: TallerConsola[]; destinos: [string, string][] }) {
  return (
    <>
      <Ventana titulo="Nueva ruta" valor="ruta" ancho={640}>
        <FormRuta />
      </Ventana>
      {rutas.map((r) => (
        <Ventana key={r.slug} titulo="Editar ruta" valor={`ruta-${r.slug}`} ancho={640}>
          <FormRuta r={r} />
        </Ventana>
      ))}
      <Ventana titulo="Nueva regla de recomendación" valor="regla" ancho={600}>
        <FormRecomendacion destinos={destinos} />
      </Ventana>
      {recomendaciones.map((r) => (
        <Ventana key={r.id} titulo="Editar regla" valor={`regla-${r.id}`} ancho={600}>
          <FormRecomendacion r={r} destinos={destinos} />
        </Ventana>
      ))}
      <Ventana titulo="Nuevo taller en vivo" valor="taller" ancho={600}>
        <FormTaller />
      </Ventana>
      {talleres.map((t) => (
        <Ventana key={t.id} titulo="Editar taller" valor={`taller-${t.id}`} ancho={600}>
          <FormTaller t={t} />
        </Ventana>
      ))}
    </>
  );
}
