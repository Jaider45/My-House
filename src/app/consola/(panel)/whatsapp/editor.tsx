"use client";

import { useActionState, useRef, useState } from "react";
import { Campo, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { Logo } from "@/components/marca";
import { CATEGORIAS, LIMITES, conEjemplos, revisar, variables, type Boton, type Categoria } from "@/lib/whatsapp/plantillas";
import { accionPlantilla, duplicar } from "./acciones";

export type PlantillaFila = {
  id: string;
  nombre: string;
  idioma: string;
  categoria: Categoria;
  encabezado: string;
  cuerpo: string;
  ejemplos: string[];
  pie: string;
  botones: Boton[];
  estado: "borrador" | "en_revision" | "aprobada" | "rechazada" | "pausada";
  motivo_rechazo: string | null;
};

/** WhatsApp usa *negrita* y _cursiva_. */
function formatoWhatsapp(t: string) {
  return t.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((p, i) =>
    p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <b key={i}>{p.slice(1, -1)}</b> : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : p,
  );
}

export function EditorPlantilla({ p, puede }: { p: PlantillaFila | null; puede: boolean }) {
  const [estado, enviar] = useActionState(accionPlantilla, null);
  const [estadoDup, enviarDup] = useActionState(duplicar, null);
  const editable = puede && (!p || p.estado === "borrador" || p.estado === "rechazada");
  const [nombre, setNombre] = useState(p?.nombre ?? "");
  const [categoria, setCategoria] = useState<Categoria>(p?.categoria ?? "UTILITY");
  const [conEncabezado, setConEncabezado] = useState(!!p?.encabezado);
  const [encabezado, setEncabezado] = useState(p?.encabezado ?? "");
  const [cuerpo, setCuerpo] = useState(p?.cuerpo ?? "");
  const [ejemplos, setEjemplos] = useState<string[]>(p?.ejemplos ?? []);
  const [pie, setPie] = useState(p?.pie ?? "My House · Finanzas del hogar");
  const [botones, setBotones] = useState<Boton[]>(p?.botones ?? []);
  const area = useRef<HTMLTextAreaElement>(null);
  const vars = variables(cuerpo);
  const plantilla = { nombre, idioma: p?.idioma ?? "es", categoria, encabezado: conEncabezado ? encabezado : "", cuerpo, ejemplos, pie, botones };
  const r = revisar(plantilla);

  const envolver = (marca: string) => {
    const t = area.current;
    if (!t) return;
    const [a, b] = [t.selectionStart, t.selectionEnd];
    setCuerpo(cuerpo.slice(0, a) + marca + cuerpo.slice(a, b) + marca + cuerpo.slice(b));
  };
  const agregarVariable = () => {
    const t = area.current;
    const n = (vars.length ? Math.max(...vars) : 0) + 1;
    const pos = t?.selectionStart ?? cuerpo.length;
    setCuerpo(`${cuerpo.slice(0, pos)}{{${n}}}${cuerpo.slice(pos)}`);
  };

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form action={enviar} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
        <input type="hidden" name="id" value={p?.id ?? ""} />
        <input type="hidden" name="categoria" value={categoria} />
        <input type="hidden" name="encabezado" value={conEncabezado ? encabezado : ""} />
        <input type="hidden" name="cuerpo" value={cuerpo} />
        <input type="hidden" name="pie" value={pie} />
        <input type="hidden" name="botones" value={JSON.stringify(botones)} />
        {vars.map((v) => (
          <input key={v} type="hidden" name="ejemplo" value={ejemplos[v - 1] ?? ""} />
        ))}
        {p?.estado === "rechazada" && (
          <p className="rounded-lg bg-error-fondo px-3 py-2 text-sm text-error-tinta">
            Meta la rechazó{p.motivo_rechazo ? `: ${p.motivo_rechazo}` : ""}. Corrígela y envíala de nuevo.
          </p>
        )}
        {p && !editable && puede && (
          <p className="rounded-lg bg-seleccion px-3 py-2 text-sm">Ya está en Meta: no se puede editar. Duplícala para hacer una versión nueva.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta="Nombre interno" name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} readOnly={!editable} className="font-mono" required />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-cuerpo">Idioma</span>
            <select name="idioma" defaultValue={p?.idioma ?? "es"} disabled={!editable} className="h-11 rounded-lg border border-control bg-elevada px-3 text-[15px]">
              <option value="es">Español</option>
              <option value="es_MX">Español (México)</option>
              <option value="en_US">Inglés (Estados Unidos)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">Categoría</span>
          <div role="radiogroup" aria-label="Categoría" className="inline-flex self-start rounded-[10px] bg-mosaico p-1">
            {CATEGORIAS.map((c) => (
              <button
                key={c.valor}
                type="button"
                role="radio"
                aria-checked={categoria === c.valor}
                disabled={!editable}
                onClick={() => setCategoria(c.valor)}
                className={cx("h-8 rounded-lg px-3 text-sm font-semibold", categoria === c.valor ? "bg-elevada shadow-sm" : "text-cuerpo")}
              >
                {c.texto}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-tenue">{CATEGORIAS.find((c) => c.valor === categoria)?.ayuda}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">Encabezado (opcional)</span>
          <div className="flex gap-2">
            {[
              [false, "Ninguno"],
              [true, "Texto"],
            ].map(([v, t]) => (
              <button
                key={String(v)}
                type="button"
                disabled={!editable}
                onClick={() => setConEncabezado(v as boolean)}
                className={cx("h-9 rounded-full border px-3 text-sm", conEncabezado === v ? "border-monte bg-monte text-arena" : "border-control bg-elevada")}
              >
                {t as string}
              </button>
            ))}
          </div>
          {conEncabezado && (
            <input value={encabezado} onChange={(e) => setEncabezado(e.target.value)} maxLength={LIMITES.encabezado} readOnly={!editable} aria-label="Encabezado" className="h-11 rounded-lg border border-control bg-elevada px-3" />
          )}
          <span className="text-[13px] text-tenue">Imagen o documento en el encabezado: créala en el panel de Meta y aparece aquí al sincronizar.</span>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">Mensaje</span>
          <span className="flex items-center gap-1 rounded-t-lg border border-b-0 border-control bg-mosaico px-2 py-1">
            <button type="button" aria-label="Negrita" disabled={!editable} onClick={() => envolver("*")} className="h-8 rounded px-2 font-bold hover:bg-elevada">
              B
            </button>
            <button type="button" aria-label="Cursiva" disabled={!editable} onClick={() => envolver("_")} className="h-8 rounded px-2 italic hover:bg-elevada">
              I
            </button>
            <button type="button" disabled={!editable} onClick={agregarVariable} className="h-8 rounded px-2 text-sm hover:bg-elevada">
              + Variable
            </button>
            <span className="ml-auto pr-1 text-[13px] text-tenue">
              {cuerpo.length.toLocaleString("es-CO")} / {LIMITES.cuerpo.toLocaleString("es-CO")}
            </span>
          </span>
          <textarea
            ref={area}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            maxLength={LIMITES.cuerpo}
            readOnly={!editable}
            rows={5}
            className="-mt-1.5 rounded-b-lg border border-control bg-elevada p-3 text-[15px] outline-none focus:border-monte"
          />
        </label>
        {vars.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-cuerpo">Ejemplos para la revisión de Meta</span>
            <div className="grid gap-2 md:grid-cols-2">
              {vars.map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <span className="rounded bg-seleccion px-1.5 font-mono text-xs">{`{{${v}}}`}</span>
                  <input
                    value={ejemplos[v - 1] ?? ""}
                    readOnly={!editable}
                    onChange={(e) => {
                      const n = [...ejemplos];
                      n[v - 1] = e.target.value;
                      setEjemplos(n);
                    }}
                    aria-label={`Ejemplo de la variable ${v}`}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-control bg-elevada px-3 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
        <Campo etiqueta="Pie (opcional)" value={pie} onChange={(e) => setPie(e.target.value)} maxLength={LIMITES.pie} readOnly={!editable} />
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-cuerpo">Botones</span>
          {botones.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-borde p-2">
              <span className="rounded-full bg-mosaico px-2.5 py-1 text-xs font-semibold">{b.tipo === "URL" ? "Enlace" : "Respuesta rápida"}</span>
              <input
                value={b.texto}
                maxLength={LIMITES.boton}
                readOnly={!editable}
                aria-label="Texto del botón"
                onChange={(e) => setBotones(botones.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                className="h-9 min-w-0 flex-1 rounded-lg border border-control bg-elevada px-3 text-sm"
              />
              {b.tipo === "URL" && (
                <input
                  value={b.url ?? ""}
                  readOnly={!editable}
                  aria-label="Dirección del botón"
                  placeholder="https://myhousecol.co/recurrentes"
                  onChange={(e) => setBotones(botones.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-control bg-elevada px-3 text-sm"
                />
              )}
              {editable && (
                <button type="button" aria-label="Quitar botón" onClick={() => setBotones(botones.filter((_, j) => j !== i))} className="h-9 rounded-lg px-2 hover:bg-mosaico">
                  ✕
                </button>
              )}
            </div>
          ))}
          {editable && botones.length < LIMITES.botones && (
            <span className="flex gap-2">
              <button type="button" onClick={() => setBotones([...botones, { tipo: "QUICK_REPLY", texto: "" }])} className="h-8 rounded-lg px-2 text-sm font-semibold hover:bg-mosaico">
                + Respuesta rápida
              </button>
              <button type="button" onClick={() => setBotones([...botones, { tipo: "URL", texto: "", url: "" }])} className="h-8 rounded-lg px-2 text-sm font-semibold hover:bg-mosaico">
                + Enlace
              </button>
              <span className="self-center text-[13px] text-tenue">máximo 3</span>
            </span>
          )}
        </div>
        <MensajeEstado estado={estado} />
        {editable && (
          <div className="flex flex-wrap gap-2">
            <BotonEnviar name="operacion" value="meta" disabled={r.errores.length > 0} pendiente="Enviando…">
              Enviar a revisión de Meta
            </BotonEnviar>
            <BotonEnviar name="operacion" value="borrador" variante="secundario">
              Guardar borrador
            </BotonEnviar>
          </div>
        )}
      </form>

      <aside className="flex flex-col gap-3.5">
        <div className="mx-auto w-full max-w-[300px] rounded-[32px] border-8 border-tinta bg-[#e9e2d7] p-0 shadow-lg">
          <div className="flex items-center gap-2 rounded-t-[24px] bg-[#0b5c4b] px-3 py-2.5 text-sm font-semibold text-white">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-arena">
              <Logo forma="isotipo" alto={20} />
            </span>
            My House
          </div>
          <div className="flex min-h-72 flex-col gap-1.5 p-3">
            <div className="max-w-[92%] rounded-lg rounded-tl-none bg-white px-2.5 py-2 text-[13px] leading-[18px] shadow-sm">
              {conEncabezado && encabezado && <p className="mb-1 font-bold">{encabezado}</p>}
              <p className="whitespace-pre-wrap">{formatoWhatsapp(conEjemplos(cuerpo, ejemplos)) || <span className="text-tenue">Escribe el mensaje…</span>}</p>
              {pie && <p className="mt-1 text-[11px] text-tenue">{pie}</p>}
              <p className="text-right text-[10px] text-tenue">7:00 a. m.</p>
            </div>
            {botones.map((b, i) => (
              <div key={i} className="max-w-[92%] rounded-lg bg-white py-2 text-center text-[13px] font-semibold text-[#0a7cff] shadow-sm">
                {b.tipo === "URL" ? "↗ " : ""}
                {b.texto || "Botón"}
              </div>
            ))}
          </div>
        </div>
        <div className={cx("rounded-xl px-3 py-2.5 text-[13px]", r.errores.length ? "bg-error-fondo text-error-tinta" : r.avisos.length ? "bg-alerta-fondo text-alerta-tinta" : "bg-ok-fondo text-ok-tinta")}>
          <b>Revisión previa:</b>{" "}
          {r.errores.length ? r.errores.join(" ") : r.avisos.length ? r.avisos.join(" ") : "sin errores. Las variables tienen ejemplos y el mensaje no pide datos bancarios ni promete dinero."}
        </div>
        {p && puede && (
          <form action={enviarDup} className="flex flex-col gap-1">
            <input type="hidden" name="nombre" value={nombre} />
            <input type="hidden" name="idioma" value={p.idioma} />
            <input type="hidden" name="categoria" value={categoria} />
            <input type="hidden" name="encabezado" value={encabezado} />
            <input type="hidden" name="cuerpo" value={cuerpo} />
            <input type="hidden" name="pie" value={pie} />
            <input type="hidden" name="botones" value={JSON.stringify(botones)} />
            {ejemplos.map((e, i) => (
              <input key={i} type="hidden" name="ejemplo" value={e} />
            ))}
            <BotonEnviar variante="fantasma" pendiente="Duplicando…">
              Duplicar como borrador
            </BotonEnviar>
            <MensajeEstado estado={estadoDup} />
          </form>
        )}
      </aside>
    </div>
  );
}
