"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton, Campo, Selector, cx } from "@/components/ui";
import { Icono } from "@/components/marca";
import { Logo } from "@/components/marca";
import { PALETA, bloqueNuevo, bloquesConVariables, conVariables, problemasCampana, type BloqueCorreo, type TipoBloque, type Variables } from "@/lib/correo/bloques";
import { armarCorreo } from "@/lib/correo/plantilla";
import { enviarPruebaEditor, guardarEditor, type DatosCampana, type EstadoEditor } from "../editor-acciones";

export type OpcionSegmento = { valor: string; texto: string; propio?: string; personas: number; sin_permiso: number };

const MUESTRA: Variables = { nombre: "Andrés", hogar: "Hogar Martínez Rojas", minimo: "$ 9.738.933", plan: "Familia", fecha_pago: "4 de diciembre" };

function Vista({ b, vars }: { b: BloqueCorreo; vars: Variables }) {
  const t = (s: string) => conVariables(s, vars);
  switch (b.tipo) {
    case "titulo":
      return <h2 className="text-[24px] leading-[30px] font-bold">{t(b.texto)}</h2>;
    case "texto":
      return <p className="text-base leading-[25px] whitespace-pre-wrap text-cuerpo">{t(b.texto)}</p>;
    case "boton":
      return b.estilo === "texto" ? (
        <p className={cx(b.alinear === "centro" && "text-center")}>
          <span className="font-bold underline">{b.texto}</span>
        </p>
      ) : (
        <div className={cx(b.alinear === "centro" && "text-center")}>
          <span
            className={cx(
              "rounded-[10px] px-6 py-3.5 font-bold",
              b.alinear === "ancho" ? "block text-center" : "inline-block",
              b.estilo === "secundario" ? "border border-cuerpo bg-elevada text-monte" : "bg-monte text-arena",
            )}
          >
            {b.texto || "Botón"}
          </span>
        </div>
      );
    case "imagen":
      // eslint-disable-next-line @next/next/no-img-element
      return b.url ? <img src={b.url} alt={b.alt} className="w-full rounded-xl" /> : <div className="flex h-32 items-center justify-center rounded-xl bg-mosaico text-sm text-tenue">Imagen (pega la dirección https://)</div>;
    case "cifra":
      return (
        <div className="flex justify-between gap-3 rounded-xl bg-seleccion p-4">
          <span className="text-cuerpo">{t(b.etiqueta)}</span>
          <b className="tabular-nums">{t(b.valor)}</b>
        </div>
      );
    case "leccion":
      return (
        <div className="rounded-xl bg-mosaico p-4">
          <p className="text-xs font-bold tracking-[0.08em] text-cuerpo uppercase">Academia My House</p>
          <b>{b.titulo} →</b>
        </div>
      );
    case "cupon":
      return (
        <div className="rounded-xl border-2 border-dashed border-monte p-4 text-center">
          <p className="text-2xl font-bold tracking-[0.12em]">{b.codigo}</p>
          <p className="text-sm text-cuerpo">{b.texto}</p>
        </div>
      );
    case "separador":
      return <hr className="border-divisor" />;
  }
}

function Propiedades({ b, cambiar }: { b: BloqueCorreo; cambiar: (n: BloqueCorreo) => void }) {
  const set = (k: string, v: string) => cambiar({ ...b, [k]: v } as BloqueCorreo);
  const chips = (k: string, opciones: [string, string][], actual: string) => (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(([v, tx]) => (
        <button key={v} type="button" onClick={() => set(k, v)} className={cx("h-8 rounded-full border px-3 text-sm", actual === v ? "border-monte bg-monte text-arena" : "border-control bg-elevada")}>
          {tx}
        </button>
      ))}
    </div>
  );
  switch (b.tipo) {
    case "titulo":
    case "texto":
      return (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">Texto</span>
          <textarea value={b.texto} onChange={(e) => set("texto", e.target.value)} rows={b.tipo === "texto" ? 6 : 2} className="rounded-lg border border-control bg-elevada p-3 text-sm" />
        </label>
      );
    case "boton":
      return (
        <>
          <Campo etiqueta="Texto" value={b.texto} onChange={(e) => set("texto", e.target.value)} maxLength={40} />
          <Selector etiqueta="Enlace" value={b.url.startsWith("/") ? b.url : "otra"} onChange={(e) => set("url", e.target.value === "otra" ? "https://" : e.target.value)}>
            <option value="/ajustes/plan">Pantalla de planes en la app</option>
            <option value="/">Inicio de la app</option>
            <option value="/academia">Academia</option>
            <option value="/rapido">Registrar un gasto</option>
            <option value="otra">Una dirección web</option>
          </Selector>
          {!b.url.startsWith("/") && <Campo etiqueta="Dirección" value={b.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />}
          <span className="text-[13px] font-semibold text-cuerpo">Estilo</span>
          {chips("estilo", [["principal", "Principal"], ["secundario", "Secundario"], ["texto", "Texto"]], b.estilo)}
          <span className="text-[13px] font-semibold text-cuerpo">Alineación</span>
          {chips("alinear", [["izquierda", "Izquierda"], ["centro", "Centro"], ["ancho", "Ancho total"]], b.alinear)}
        </>
      );
    case "imagen":
      return (
        <>
          <Campo etiqueta="Dirección de la imagen" value={b.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
          <Campo etiqueta="Descripción (para quien no ve imágenes)" value={b.alt} onChange={(e) => set("alt", e.target.value)} />
        </>
      );
    case "cifra":
      return (
        <>
          <Campo etiqueta="Etiqueta" value={b.etiqueta} onChange={(e) => set("etiqueta", e.target.value)} />
          <Campo etiqueta="Valor" value={b.valor} onChange={(e) => set("valor", e.target.value)} ayuda="Usa una variable, por ejemplo {minimo}." />
        </>
      );
    case "leccion":
      return (
        <>
          <Campo etiqueta="Título de la lección" value={b.titulo} onChange={(e) => set("titulo", e.target.value)} />
          <Campo etiqueta="Ruta" value={b.url} onChange={(e) => set("url", e.target.value)} placeholder="/academia/finanzas/numero-minimo" />
        </>
      );
    case "cupon":
      return (
        <>
          <Campo etiqueta="Código" value={b.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} />
          <Campo etiqueta="Texto" value={b.texto} onChange={(e) => set("texto", e.target.value)} />
        </>
      );
    case "separador":
      return <p className="text-sm text-tenue">Una línea para separar secciones.</p>;
  }
}

export function EditorCampana({ inicial, segmentos, programada }: { inicial: DatosCampana; segmentos: OpcionSegmento[]; programada: boolean }) {
  const router = useRouter();
  const [d, setD] = useState<DatosCampana>(inicial);
  const [sel, setSel] = useState<number | null>(inicial.bloques.length ? 0 : null);
  const [panel, setPanel] = useState<"bloque" | "envio">("bloque");
  const [celular, setCelular] = useState(false);
  const [conDatos, setConDatos] = useState(true);
  const [exacta, setExacta] = useState(false);
  const [estado, setEstado] = useState<EstadoEditor>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const sucio = useRef(false);
  const vars = useMemo<Variables>(() => (conDatos ? MUESTRA : {}), [conDatos]);
  const seg = segmentos.find((s) => (d.segmento === "propio" ? s.propio === d.segmento_propio : s.valor === d.segmento));
  const problemas = problemasCampana(d);

  const cambiar = (parcial: Partial<DatosCampana>) => {
    sucio.current = true;
    setD((x) => ({ ...x, ...parcial }));
  };
  const setBloques = (bloques: BloqueCorreo[]) => cambiar({ bloques });
  const agregar = (tipo: TipoBloque, en?: number) => {
    const n = [...d.bloques];
    const i = en ?? (sel !== null ? sel + 1 : n.length);
    n.splice(i, 0, bloqueNuevo(tipo));
    setBloques(n);
    setSel(i);
    setPanel("bloque");
  };
  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= d.bloques.length) return;
    const n = [...d.bloques];
    [n[i], n[j]] = [n[j], n[i]];
    setBloques(n);
    setSel(j);
  };

  const guardar = (programar: boolean) =>
    iniciar(async () => {
      const r = await guardarEditor(d, programar);
      setEstado(r);
      if (r?.id) {
        sucio.current = false;
        setGuardado(r.guardado ?? null);
        if (!d.id) {
          setD((x) => ({ ...x, id: r.id! }));
          router.replace(`/consola/comunicaciones/editor?id=${r.id}`, { scroll: false });
        }
        if (programar) router.push("/consola/comunicaciones");
      }
    });

  // Guardado automático del borrador (no en una campaña ya programada: la devolvería a borrador).
  useEffect(() => {
    if (programada || !sucio.current) return;
    const t = setTimeout(() => {
      if (sucio.current && d.nombre.trim()) guardar(false);
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, programada]);

  const html = useMemo(() => {
    if (!exacta) return "";
    const bs = bloquesConVariables(d.bloques, vars);
    const i = bs.findIndex((b) => b.tipo === "titulo");
    return armarCorreo(
      {
        asunto: conVariables(d.asunto, vars),
        vistaPrevia: d.vista_previa,
        etiqueta: "Novedades",
        titulo: i >= 0 ? (bs[i] as { texto: string }).texto : conVariables(d.asunto, vars),
        intro: "",
        bloques: bs.filter((_, j) => j !== i),
        porque: "Recibes este correo porque aceptaste comunicaciones de My House.",
        enlacesPie: [
          { texto: "Dejar de recibirlos", url: "#" },
          { texto: "Política de datos", url: "#" },
        ],
      },
      typeof window === "undefined" ? "" : window.location.origin,
    ).html;
  }, [exacta, d, vars]);

  const pasos: [string, boolean][] = [
    ["Diseño", d.bloques.length > 0],
    ["Audiencia", Boolean(seg)],
    ["Revisar y enviar", programada],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {pasos.map(([t, hecho], i) => (
            <li key={t} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="h-px w-6 bg-control" />}
              <button type="button" onClick={() => setPanel(i === 0 ? "bloque" : "envio")} className="flex items-center gap-2 font-semibold">
                <span className={cx("inline-flex size-6 items-center justify-center rounded-full text-xs", hecho ? "bg-monte text-arena" : "border border-control")}>{hecho ? "✓" : i + 1}</span>
                {t}
              </button>
            </li>
          ))}
        </ol>
        <span className="flex-1" />
        <span className="text-[13px] text-tenue">{pendiente ? "Guardando…" : guardado ? `Guardado a las ${guardado}` : programada ? "Programada" : ""}</span>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="flex flex-col gap-2 rounded-2xl border border-borde bg-elevada p-4">
          <p className="text-xs font-bold tracking-[0.08em] text-tenue uppercase">Bloques</p>
          {PALETA.map((p) => (
            <button
              key={p.tipo}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/bloque", p.tipo)}
              onClick={() => agregar(p.tipo)}
              className="flex h-10 items-center gap-2 rounded-lg border border-borde px-2.5 text-left text-sm hover:bg-mosaico"
            >
              <span aria-hidden className="cursor-grab text-tenue">
                ⋮⋮
              </span>
              <Icono nombre={p.icono} tamano={18} />
              {p.texto}
            </button>
          ))}
          <p className="text-[13px] text-tenue">Tócalos o arrástralos al correo. Los colores y la letra salen de la marca.</p>
        </aside>

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Vista" className="inline-flex rounded-[10px] bg-mosaico p-1">
              {[
                [false, "Escritorio"],
                [true, "Celular"],
              ].map(([v, t]) => (
                <button key={String(v)} type="button" onClick={() => setCelular(v as boolean)} className={cx("h-8 rounded-lg px-3 text-sm font-semibold", celular === v ? "bg-elevada shadow-sm" : "text-cuerpo")}>
                  {t as string}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <div role="group" aria-label="Ver como" className="inline-flex rounded-[10px] bg-mosaico p-1">
                {[
                  [true, "Andrés · Familia"],
                  [false, "Hogar sin datos"],
                ].map(([v, t]) => (
                  <button key={String(v)} type="button" onClick={() => setConDatos(v as boolean)} className={cx("h-8 rounded-lg px-3 text-sm font-semibold", conDatos === v ? "bg-elevada shadow-sm" : "text-cuerpo")}>
                    {t as string}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setExacta(!exacta)} className="h-10 rounded-lg px-3 text-sm font-semibold hover:bg-mosaico">
                {exacta ? "Volver a editar" : "Vista exacta"}
              </button>
            </div>
          </div>
          <div className="flex justify-center rounded-2xl bg-pagina p-4">
            {exacta ? (
              <iframe title="Vista exacta del correo" srcDoc={html} className={cx("h-[720px] rounded-xl border border-borde bg-white", celular ? "w-[375px]" : "w-full max-w-[680px]")} sandbox="" />
            ) : (
              <div
                className={cx("flex flex-col overflow-hidden rounded-2xl border border-borde bg-elevada", celular ? "w-[375px]" : "w-full max-w-[600px]")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const tipo = e.dataTransfer.getData("text/bloque") as TipoBloque;
                  if (tipo) agregar(tipo, d.bloques.length);
                }}
              >
                <div className="flex items-center justify-between border-b border-[#efe7db] bg-arena px-6 py-4">
                  <Logo alto={26} />
                  <span className="text-xs font-bold tracking-[0.1em] text-cuerpo">NOVEDADES</span>
                </div>
                <div className="flex flex-col gap-1 p-5">
                  {d.bloques.length === 0 && <p className="rounded-xl border border-dashed border-control p-8 text-center text-sm text-tenue">Arrastra o toca un bloque para empezar.</p>}
                  {d.bloques.map((b, i) => (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSel(i);
                        setPanel("bloque");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && setSel(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        const tipo = e.dataTransfer.getData("text/bloque") as TipoBloque;
                        if (tipo) agregar(tipo, i);
                      }}
                      className={cx("relative rounded-lg p-2 outline-2 outline-offset-2", sel === i ? "outline outline-monte" : "hover:outline hover:outline-control")}
                    >
                      {sel === i && (
                        <span className="absolute -top-3 right-2 z-10 flex gap-1 rounded-md bg-monte px-1.5 py-0.5 text-xs text-arena">
                          <button type="button" aria-label="Subir" onClick={(e) => (e.stopPropagation(), mover(i, -1))}>
                            ↑
                          </button>
                          <button type="button" aria-label="Bajar" onClick={(e) => (e.stopPropagation(), mover(i, 1))}>
                            ↓
                          </button>
                          <button type="button" aria-label="Duplicar" onClick={(e) => (e.stopPropagation(), setBloques([...d.bloques.slice(0, i + 1), { ...b }, ...d.bloques.slice(i + 1)]))}>
                            ⧉
                          </button>
                          <button
                            type="button"
                            aria-label="Quitar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBloques(d.bloques.filter((_, j) => j !== i));
                              setSel(null);
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      )}
                      <Vista b={b} vars={vars} />
                    </div>
                  ))}
                  <p className="mt-3 text-[13px] text-tenue">
                    Recibes este correo porque aceptaste comunicaciones de My House. <u>Dejar de recibirlos</u> · <u>Política de datos</u>
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-3 rounded-2xl border border-borde bg-elevada p-4">
          <div role="tablist" aria-label="Panel" className="inline-flex self-start rounded-[10px] bg-mosaico p-1">
            {[
              ["bloque", "Bloque"],
              ["envio", "Envío"],
            ].map(([k, t]) => (
              <button key={k} type="button" role="tab" aria-selected={panel === k} onClick={() => setPanel(k as "bloque" | "envio")} className={cx("h-8 rounded-lg px-3 text-sm font-semibold", panel === k ? "bg-elevada shadow-sm" : "text-cuerpo")}>
                {t}
              </button>
            ))}
          </div>
          {panel === "bloque" ? (
            sel !== null && d.bloques[sel] ? (
              <>
                <b>{PALETA.find((p) => p.tipo === d.bloques[sel].tipo)?.texto}</b>
                <Propiedades b={d.bloques[sel]} cambiar={(n) => setBloques(d.bloques.map((x, j) => (j === sel ? n : x)))} />
                <span className="text-[13px] font-semibold text-cuerpo">Variables disponibles</span>
                <span className="flex flex-wrap gap-1.5">
                  {["{nombre}", "{hogar}", "{minimo}", "{plan}", "{fecha_pago}"].map((v) => (
                    <code key={v} className="rounded bg-seleccion px-1.5 text-xs">
                      {v}
                    </code>
                  ))}
                </span>
              </>
            ) : (
              <p className="text-sm text-tenue">Toca un bloque del correo para editarlo.</p>
            )
          ) : (
            <>
              <Campo etiqueta="Nombre interno" value={d.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} maxLength={80} />
              <Campo etiqueta="Asunto A" value={d.asunto} onChange={(e) => cambiar({ asunto: e.target.value })} maxLength={150} />
              <Campo etiqueta={`Asunto B · ${d.prueba_ab_pct || 20} % de prueba (opcional)`} value={d.asunto_b} onChange={(e) => cambiar({ asunto_b: e.target.value })} maxLength={150} />
              {d.asunto_b && (
                <Campo etiqueta="% del segmento que recibe el asunto B" type="number" min={5} max={50} value={d.prueba_ab_pct || 20} onChange={(e) => cambiar({ prueba_ab_pct: Number(e.target.value) })} />
              )}
              <Campo etiqueta="Vista previa" value={d.vista_previa} onChange={(e) => cambiar({ vista_previa: e.target.value })} maxLength={150} ayuda="Lo que el buzón muestra junto al asunto." />
              <Selector
                etiqueta="Segmento"
                value={d.segmento === "propio" ? `propio:${d.segmento_propio}` : d.segmento}
                onChange={(e) => {
                  const v = e.target.value;
                  cambiar(v.startsWith("propio:") ? { segmento: "propio", segmento_propio: v.slice(7) } : { segmento: v, segmento_propio: null });
                }}
              >
                {segmentos.map((s) => (
                  <option key={s.propio ?? s.valor} value={s.propio ? `propio:${s.propio}` : s.valor}>
                    {s.texto} · {s.personas.toLocaleString("es-CO")} con permiso
                  </option>
                ))}
              </Selector>
              <Campo etiqueta="Cuándo (hora de Bogotá; vacío = borrador)" type="datetime-local" value={d.programada} onChange={(e) => cambiar({ programada: e.target.value })} />
              {seg && (
                <p className="rounded-lg bg-seleccion px-3 py-2 text-[13px]">
                  Solo llega a quienes aceptaron comunicaciones comerciales.
                  {seg.sin_permiso > 0 ? ` ${seg.sin_permiso.toLocaleString("es-CO")} hogares del segmento no lo aceptaron.` : ""} Sale con el envío diario (7:15 a. m.) desde la hora elegida.
                </p>
              )}
            </>
          )}
          {estado?.error && <p className="rounded-lg bg-error-fondo px-3 py-2 text-sm text-error-tinta">{estado.error}</p>}
          {estado?.ok && <p className="rounded-lg bg-ok-fondo px-3 py-2 text-sm text-ok-tinta">{estado.ok}</p>}
          {problemas.length > 0 && <p className="text-[13px] text-tenue">Falta: {problemas.join(" ")}</p>}
          <div className="flex flex-col gap-2 border-t border-divisor pt-3">
            <Boton type="button" disabled={pendiente || problemas.length > 0} onClick={() => guardar(true)}>
              Programar envío
            </Boton>
            <div className="flex gap-2">
              <Boton type="button" variante="secundario" className="flex-1" disabled={pendiente} onClick={() => iniciar(async () => setEstado(await enviarPruebaEditor(d, "a")))}>
                Enviar prueba
              </Boton>
              {d.asunto_b && (
                <Boton type="button" variante="secundario" disabled={pendiente} onClick={() => iniciar(async () => setEstado(await enviarPruebaEditor(d, "b")))}>
                  Prueba B
                </Boton>
              )}
            </div>
            <Boton type="button" variante="fantasma" disabled={pendiente || !d.nombre.trim()} onClick={() => guardar(false)}>
              Guardar borrador
            </Boton>
          </div>
        </aside>
      </div>
    </div>
  );
}
