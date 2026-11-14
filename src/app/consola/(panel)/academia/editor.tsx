"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { AreaTexto, Campo, Chip, Selector, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import type { Bloque } from "@/lib/academia";
import { bloquesATexto, formatos } from "@/lib/academia/texto";
import { accionLeccion, despublicarLeccion, ordenarLecciones } from "./acciones";

export type LeccionConsola = {
  id: string;
  slug: string;
  titulo: string;
  minutos: number;
  orden: number;
  bloques: Bloque[];
  publicada: boolean;
  borrador: { titulo: string; minutos: number; bloques: Bloque[] } | null;
  editada_por: string | null;
  vistas: number;
  calificacion: number | null;
};

/** Pantallas que puede abrir «Aplícalo en My House». */
const DESTINOS = [
  ["/presupuesto", "Presupuesto"],
  ["/metas", "Metas"],
  ["/recurrentes", "Pagos fijos"],
  ["/deudas", "Deudas"],
  ["/movimientos", "Movimientos"],
  ["/impuestos", "Renta DIAN"],
  ["/cuentas", "Cuentas"],
  ["/comprobantes", "Asistente"],
  ["/ajustes/miembros", "Miembros del hogar"],
  ["/ajustes/personas", "Personas a cargo"],
  ["/", "Inicio"],
] as const;

/** Lista de lecciones: se arrastran para ordenarlas (o con las flechas, con teclado). */
export function ListaLecciones({ ruta, lecciones, actual, empezaron, puede }: { ruta: string; lecciones: LeccionConsola[]; actual: string | null; empezaron: number; puede: boolean }) {
  const [orden, setOrden] = useState(lecciones.map((l) => l.id));
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const porId = new Map(lecciones.map((l) => [l.id, l]));
  const guardar = (nuevo: string[]) => {
    setOrden(nuevo);
    iniciar(async () => {
      const r = await ordenarLecciones(ruta, nuevo);
      setMensaje(r?.error ?? r?.ok ?? null);
    });
  };
  const mover = (id: string, delta: number) => {
    const i = orden.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= orden.length) return;
    const nuevo = [...orden];
    [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    guardar(nuevo);
  };
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-borde bg-elevada p-4">
      <div className="flex items-center justify-between gap-2">
        <b>Lecciones{puede ? " · arrástralas para ordenarlas" : ""}</b>
        {puede && (
          <a href={`?ruta=${ruta}&leccion=nueva`} className="text-sm font-semibold underline-offset-4 hover:underline">
            + Lección
          </a>
        )}
      </div>
      <ol className="flex flex-col gap-1.5">
        {orden.map((id, i) => {
          const l = porId.get(id)!;
          const pct = empezaron ? Math.round((100 * l.vistas) / empezaron) : null;
          return (
            <li
              key={id}
              draggable={puede}
              onDragStart={() => setArrastrando(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!arrastrando || arrastrando === id) return;
                const nuevo = orden.filter((x) => x !== arrastrando);
                nuevo.splice(nuevo.indexOf(id), 0, arrastrando);
                setArrastrando(null);
                guardar(nuevo);
              }}
              className={cx("flex items-center gap-2 rounded-xl border p-2.5", id === actual ? "border-monte bg-seleccion" : "border-borde", arrastrando === id && "opacity-50")}
            >
              {puede && (
                <span aria-hidden className="cursor-grab font-bold tracking-[-2px] text-tenue">
                  ⋮⋮
                </span>
              )}
              <span className="w-5 text-[13px] text-tenue">{i + 1}</span>
              <a href={`?ruta=${ruta}&leccion=${id}`} className="min-w-0 flex-1">
                <b className="block truncate text-sm">{l.borrador?.titulo ?? l.titulo}</b>
                <span className="text-[13px] text-tenue">
                  {formatos(l.borrador?.bloques ?? l.bloques).join(" + ") || "Sin contenido"} · {l.borrador?.minutos ?? l.minutos} min
                  {pct !== null && l.publicada ? ` · ${pct} % la terminan` : ""}
                  {l.calificacion ? ` · ★ ${l.calificacion.toLocaleString("es-CO")}` : ""}
                </span>
              </a>
              <Chip tono={!l.publicada ? "info" : l.borrador ? "alerta" : "ok"}>{!l.publicada ? "Borrador" : l.borrador ? "Cambios sin publicar" : "Publicada"}</Chip>
              {puede && (
                <span className="flex flex-col">
                  <button type="button" aria-label="Subir" disabled={i === 0 || pendiente} onClick={() => mover(id, -1)} className="px-1 text-xs leading-3 disabled:opacity-30">
                    ▲
                  </button>
                  <button type="button" aria-label="Bajar" disabled={i === orden.length - 1 || pendiente} onClick={() => mover(id, 1)} className="px-1 text-xs leading-3 disabled:opacity-30">
                    ▼
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {mensaje && <p className="text-[13px] text-tenue">{mensaje}</p>}
    </section>
  );
}

export function EditorLeccion({
  ruta,
  rutaTitulo,
  indice,
  l,
  guias,
  puede,
}: {
  ruta: string;
  rutaTitulo: string;
  indice: number;
  l: LeccionConsola | null;
  guias: { id: string; titulo: string }[];
  puede: boolean;
}) {
  const [estado, enviar] = useActionState(accionLeccion, null);
  const [estadoQuitar, quitar] = useActionState(despublicarLeccion, null);
  const base = l?.borrador ?? (l ? { titulo: l.titulo, minutos: l.minutos, bloques: l.bloques } : { titulo: "", minutos: 3, bloques: [] as Bloque[] });
  const { contenido, extras } = bloquesATexto(base.bloques);
  const [formato, setFormato] = useState(() => new Set([...(extras.video ? ["video"] : []), ...(extras.quiz ? ["repaso"] : []), ...(extras.plantilla ? ["plantilla"] : [])]));
  const area = useRef<HTMLTextAreaElement>(null);
  const insertar = (antes: string, despues = "") => {
    const t = area.current;
    if (!t) return;
    const [a, b] = [t.selectionStart, t.selectionEnd];
    t.setRangeText(antes + t.value.slice(a, b) + despues, a, b, "end");
    t.focus();
  };
  const cambiar = (f: string) => {
    const n = new Set(formato);
    if (n.has(f)) n.delete(f);
    else n.add(f);
    setFormato(n);
  };
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.08em] text-tenue uppercase">
            {rutaTitulo} · {l ? `lección ${indice + 1}` : "lección nueva"}
          </p>
          <h2 className="text-xl font-bold">{base.titulo || "Sin título"}</h2>
          {l?.editada_por && <p className="text-[13px] text-tenue">Editada por {l.editada_por}</p>}
        </div>
        {l?.publicada && (
          <a href={`/academia/${ruta}/${l.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold underline-offset-4 hover:underline">
            Ver como usuario
          </a>
        )}
      </div>
      <form action={enviar} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={l?.id ?? ""} />
        <input type="hidden" name="ruta" value={ruta} />
        {[...formato].map((f) => (
          <input key={f} type="hidden" name="formato" value={f} />
        ))}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">Formato</span>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex h-9 items-center rounded-full border border-monte bg-monte px-3 text-sm text-arena">Lectura</span>
            {[
              ["video", "Video"],
              ["repaso", "Pregunta de repaso"],
              ["plantilla", "Plantilla descargable"],
            ].map(([k, tx]) => (
              <button
                key={k}
                type="button"
                aria-pressed={formato.has(k)}
                disabled={!puede}
                onClick={() => cambiar(k)}
                className={cx("h-9 rounded-full border px-3 text-sm", formato.has(k) ? "border-monte bg-monte text-arena" : "border-control bg-elevada")}
              >
                {tx}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <Campo etiqueta="Título" name="titulo" defaultValue={base.titulo} required maxLength={120} readOnly={!puede} />
          <Campo etiqueta="Tiempo de lectura (min)" name="minutos" type="number" min={1} max={60} defaultValue={base.minutos} readOnly={!puede} />
        </div>
        {formato.has("video") && (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
            <Campo etiqueta="Video (YouTube, Vimeo…)" name="video_url" defaultValue={extras.video?.url} placeholder="https://youtube.com/…" />
            <Campo etiqueta="Duración" name="video_duracion" defaultValue={extras.video?.duracion} placeholder="6:24" />
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">Contenido</span>
          {puede && (
            <span className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-control bg-mosaico px-2 py-1 text-sm">
              <button type="button" onClick={() => insertar("\n\n## ")} className="h-8 rounded px-2 hover:bg-elevada">
                Subtítulo
              </button>
              <button type="button" onClick={() => insertar("\n\n+ Título | texto\n+ Título | texto")} className="h-8 rounded px-2 hover:bg-elevada">
                Tarjetas de opciones
              </button>
            </span>
          )}
          <textarea
            ref={area}
            name="contenido"
            defaultValue={contenido}
            rows={12}
            readOnly={!puede}
            className={cx("min-h-56 border border-control bg-elevada p-3 text-[15px] leading-6 outline-none focus:border-monte", puede ? "-mt-1.5 rounded-b-lg" : "rounded-lg")}
          />
          <span className="text-[13px] text-tenue">Párrafos separados por una línea en blanco. «## Subtítulo». Tarjetas: una por línea, «+ Título | texto».</span>
        </label>
        {formato.has("plantilla") && (
          <div className="grid gap-3 md:grid-cols-2">
            <Campo etiqueta="Nombre de la plantilla" name="plantilla_titulo" defaultValue={extras.plantilla?.titulo} placeholder="Agenda de la reunión de plata" />
            <Campo etiqueta="Dirección de descarga" name="plantilla_url" defaultValue={extras.plantilla?.url} placeholder="https://…" />
          </div>
        )}
        {formato.has("repaso") && (
          <fieldset className="flex flex-col gap-3 rounded-xl bg-mosaico p-3.5">
            <legend className="px-1 text-sm font-semibold">Pregunta de repaso</legend>
            <Campo etiqueta="Pregunta" name="quiz_pregunta" defaultValue={extras.quiz?.pregunta} />
            <AreaTexto etiqueta="Opciones (una por línea)" name="quiz_opciones" defaultValue={extras.quiz?.opciones.join("\n")} rows={3} />
            <div className="grid gap-3 md:grid-cols-3">
              <Selector etiqueta="Correcta" name="quiz_correcta" defaultValue={String(extras.quiz?.correcta ?? 0)}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    Opción {n + 1}
                  </option>
                ))}
              </Selector>
              <Campo etiqueta="Si acierta" name="quiz_bien" defaultValue={extras.quiz?.bien} />
              <Campo etiqueta="Si falla" name="quiz_mal" defaultValue={extras.quiz?.mal} />
            </div>
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-3 rounded-xl border border-borde p-3.5">
          <legend className="px-1 text-sm font-semibold">Botón «Aplícalo en My House» (opcional)</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <Campo etiqueta="Texto del botón" name="aplica_boton" defaultValue={extras.aplica?.boton} placeholder="Ver nuestra repartición" />
            <Selector etiqueta="Abre" name="aplica_href" defaultValue={extras.aplica?.href ?? ""}>
              <option value="">Sin botón</option>
              {DESTINOS.map(([v, tx]) => (
                <option key={v} value={v}>
                  {tx}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="Título de la tarjeta" name="aplica_titulo" defaultValue={extras.aplica?.titulo} />
            <Campo etiqueta="Texto de la tarjeta" name="aplica_texto" defaultValue={extras.aplica?.texto} />
          </div>
        </fieldset>
        <div className="grid gap-3 md:grid-cols-2">
          <Selector etiqueta="Guía interactiva (opcional)" name="guia_id" defaultValue={extras.guia?.id ?? ""}>
            <option value="">Sin guía</option>
            {guias.map((g) => (
              <option key={g.id} value={g.id}>
                {g.titulo}
              </option>
            ))}
          </Selector>
          <Campo etiqueta="Texto de la guía" name="guia_texto" defaultValue={extras.guia?.texto} />
        </div>
        <MensajeEstado estado={estado} />
        {puede && (
          <div className="flex flex-wrap gap-2">
            <BotonEnviar name="operacion" value="publicar" pendiente="Publicando…">
              {l?.publicada ? "Publicar cambios" : "Publicar"}
            </BotonEnviar>
            <BotonEnviar name="operacion" value="borrador" variante="fantasma">
              Guardar borrador
            </BotonEnviar>
          </div>
        )}
      </form>
      {puede && l?.publicada && (
        <form action={quitar} className="flex flex-col items-start gap-1 border-t border-divisor pt-3">
          <input type="hidden" name="id" value={l.id} />
          <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
            Quitar de la app
          </BotonEnviar>
          <MensajeEstado estado={estadoQuitar} />
        </form>
      )}
    </section>
  );
}
