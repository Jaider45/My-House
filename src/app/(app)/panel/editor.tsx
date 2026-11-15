"use client";

import { useActionState, useState } from "react";
import { Icono, type NombreIcono } from "@/components/marca";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { cx } from "@/components/ui";
import {
  INDICADORES,
  MAX_INDICADORES,
  PLANTILLAS,
  SECCIONES,
  panelDePlantilla,
  type IdIndicador,
  type IdPlantilla,
  type IdSeccion,
  type Panel,
} from "@/lib/panel";
import { guardarPanel } from "./acciones";

const GRUPOS = ["Mes", "Ahorro", "Deudas", "Cuentas"] as const;

/** Lista ordenable: subir, bajar y quitar. */
function Elegidos<T extends string>({ ids, nombre, alCambiar }: { ids: T[]; nombre: (id: T) => { nombre: string; descripcion: string }; alCambiar: (ids: T[]) => void }) {
  const mover = (i: number, d: -1 | 1) => {
    const copia = [...ids];
    [copia[i], copia[i + d]] = [copia[i + d], copia[i]];
    alCambiar(copia);
  };
  const boton = "inline-flex size-9 items-center justify-center rounded-lg text-tinta hover:bg-mosaico disabled:opacity-30 disabled:hover:bg-transparent";
  if (!ids.length) return <p className="rounded-xl border border-dashed border-control px-4 py-3 text-sm text-tenue">Nada elegido todavía.</p>;
  return (
    <ol className="flex flex-col divide-y divide-divisor rounded-xl border border-borde">
      {ids.map((id, i) => (
        <li key={id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3.5">
          <span className="w-5 shrink-0 text-[13px] font-semibold text-tenue">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] leading-5">{nombre(id).nombre}</b>
            <span className="block truncate text-[13px] text-cuerpo">{nombre(id).descripcion}</span>
          </span>
          <button type="button" className={boton} onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${nombre(id).nombre}`}>
            ↑
          </button>
          <button type="button" className={boton} onClick={() => mover(i, 1)} disabled={i === ids.length - 1} aria-label={`Bajar ${nombre(id).nombre}`}>
            ↓
          </button>
          <button type="button" className={boton} onClick={() => alCambiar(ids.filter((x) => x !== id))} aria-label={`Quitar ${nombre(id).nombre}`}>
            ✕
          </button>
        </li>
      ))}
    </ol>
  );
}

const ficha = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-control bg-elevada px-3 py-1 text-sm font-semibold hover:bg-mosaico disabled:opacity-40";

/**
 * Editor del Inicio (ventana «Personalizar»): elige una plantilla con un foco (ahorro, deudas, gasto…) y ajústala:
 * qué indicadores y qué secciones ver y en qué orden. Lo que guarda es solo de esta persona.
 */
export function EditorPanel({ inicial }: { inicial: Panel }) {
  const [estado, accion] = useActionState(guardarPanel, null);
  useCerrarAlGuardar(estado);
  const [plantilla, setPlantilla] = useState<Panel["plantilla"]>(inicial.plantilla);
  const [indicadores, setIndicadores] = useState<IdIndicador[]>(inicial.indicadores);
  const [secciones, setSecciones] = useState<IdSeccion[]>(inicial.secciones);

  const elegir = (id: IdPlantilla) => {
    const p = panelDePlantilla(id);
    setPlantilla(id);
    setIndicadores(p.indicadores);
    setSecciones(p.secciones);
  };
  const base = plantilla !== "propio" ? PLANTILLAS[plantilla] : null;
  const cambiada = !base || base.indicadores.join() !== indicadores.join() || base.secciones.join() !== secciones.join();
  const lleno = indicadores.length >= MAX_INDICADORES;

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="panel" value={JSON.stringify({ plantilla, indicadores, secciones })} />

      <section aria-labelledby="panel-plantillas" className="flex flex-col gap-2">
        <h3 id="panel-plantillas" className="text-[13px] font-semibold text-cuerpo">
          Empieza con una plantilla
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(PLANTILLAS) as IdPlantilla[]).map((id) => {
            const p = PLANTILLAS[id];
            const activa = plantilla === id && !cambiada;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={activa}
                onClick={() => elegir(id)}
                className={cx(
                  "flex items-start gap-3 rounded-xl px-3.5 py-3 text-left",
                  activa ? "border-2 border-monte bg-seleccion" : "border border-control bg-elevada hover:bg-mosaico",
                )}
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-arena">
                  <Icono nombre={p.icono as NombreIcono} tamano={20} />
                </span>
                <span>
                  <b className="block text-[15px] leading-5">{p.nombre}</b>
                  <span className="block text-[13px] leading-[18px] text-cuerpo">{p.descripcion}</span>
                </span>
              </button>
            );
          })}
        </div>
        {cambiada && <p className="text-[13px] text-tenue">{base ? `Basado en «${base.nombre}», con tus cambios.` : "Armado a tu gusto."}</p>}
      </section>

      <section aria-labelledby="panel-indicadores" className="flex flex-col gap-2">
        <h3 id="panel-indicadores" className="text-[13px] font-semibold text-cuerpo">
          Indicadores · {indicadores.length} de {MAX_INDICADORES}
        </h3>
        <Elegidos ids={indicadores} nombre={(id) => INDICADORES[id]} alCambiar={setIndicadores} />
        <div className="flex flex-col gap-2 pt-1">
          {GRUPOS.map((g) => {
            const libres = (Object.keys(INDICADORES) as IdIndicador[]).filter((id) => INDICADORES[id].grupo === g && !indicadores.includes(id));
            if (!libres.length) return null;
            return (
              <div key={g} className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-[13px] text-tenue">{g}</span>
                {libres.map((id) => (
                  <button key={id} type="button" className={ficha} disabled={lleno} title={INDICADORES[id].descripcion} onClick={() => setIndicadores([...indicadores, id])}>
                    + {INDICADORES[id].nombre}
                  </button>
                ))}
              </div>
            );
          })}
          {lleno && <p className="text-[13px] text-tenue">Ya tienes {MAX_INDICADORES}: quita uno para agregar otro.</p>}
        </div>
      </section>

      <section aria-labelledby="panel-secciones" className="flex flex-col gap-2">
        <h3 id="panel-secciones" className="text-[13px] font-semibold text-cuerpo">
          Secciones, en este orden
        </h3>
        <Elegidos ids={secciones} nombre={(id) => SECCIONES[id]} alCambiar={setSecciones} />
        <div className="flex flex-wrap gap-2 pt-1">
          {(Object.keys(SECCIONES) as IdSeccion[])
            .filter((id) => !secciones.includes(id))
            .map((id) => (
              <button key={id} type="button" className={ficha} title={SECCIONES[id].descripcion} onClick={() => setSecciones([...secciones, id])}>
                + {SECCIONES[id].nombre}
              </button>
            ))}
        </div>
      </section>

      <p className="text-[13px] text-tenue">Este Inicio es solo tuyo: las demás personas del hogar arman el suyo.</p>
      <MensajeEstado estado={estado} />
      <PieVentana pendiente="Guardando…">Guardar mi Inicio</PieVentana>
    </form>
  );
}
