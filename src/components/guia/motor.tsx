"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton, CuadroIcono, cx } from "@/components/ui";
import { EVENTO_GUIA, coincideRuta, guiaPorId, guiasPara, leerEnCurso, type Guia, type GuiaEnCurso, type IdGuia } from "@/lib/guias";
import { marcarGuiaVista } from "@/app/(app)/guias/acciones";

const CLAVE = "mh_guia";
const CLAVE_OFERTA = "mh_guia_oferta";
/** Cuánto esperar a que aparezca lo que hay que iluminar (la pantalla carga, el servidor responde…). */
const ESPERA_MS = 15000;
const MENU = '[aria-label="Navegación principal"]';
const MARGEN = 12;
const RELLENO = 6;

type Rect = { top: number; left: number; width: number; height: number };
type Vista =
  | { tipo: "buscando" }
  | { tipo: "faltante" }
  | { tipo: "menu"; rect: Rect; texto: string }
  | { tipo: "listo"; rect: Rect | null };

const esVisible = (el: Element) => {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none";
};

/** Un campo se ilumina con su etiqueta (el usuario ve qué es); los campos ocultos de montos también. */
const resaltable = (el: Element) => (el.matches("input, select, textarea") ? (el.closest("label") ?? el) : el);

function buscar(selector: string): Element | null {
  let lista: Element[];
  try {
    lista = [...document.querySelectorAll(selector)];
  } catch {
    return null; // selector mal escrito: se trata como «no está»
  }
  for (const el of lista) {
    if (el.closest("[data-guia-motor]")) continue;
    const r = resaltable(el);
    if (esVisible(r)) return r;
  }
  return null;
}

const aRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};
const mismoRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);
const mismaVista = (a: Vista, b: Vista) =>
  a.tipo === b.tipo && (a.tipo !== "listo" && a.tipo !== "menu" ? true : mismoRect(a.rect, (b as typeof a).rect));

/**
 * Motor de las guías (va en el layout). Se inicia con `window.dispatchEvent(new CustomEvent(EVENTO_GUIA, {detail: id}))`
 * (lo hace `BotonGuia`) y recuerda el paso en sessionStorage para seguir tras cambiar de pantalla o recargar.
 * A quien nunca vio la bienvenida le ofrece el recorrido una vez.
 */
export function MotorGuia({ vistas, nombre, rol }: { vistas: IdGuia[]; nombre: string; rol: "admin" | "editor" | "contador" | "familiar" }) {
  const [enCurso, setEnCurso] = useState<GuiaEnCurso | null>(null);
  const [oferta, setOferta] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

  useEffect(() => {
    const guardada = leerEnCurso(sessionStorage.getItem(CLAVE));
    // Al montar se lee el navegador (no existe en el servidor): un único ajuste de estado inicial.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (guardada) setEnCurso(guardada);
    else if (!vistas.includes("bienvenida") && !sessionStorage.getItem(CLAVE_OFERTA)) setOferta(true);
    const alIniciar = (e: Event) => {
      const g = guiaPorId(String((e as CustomEvent<unknown>).detail));
      if (!g) return;
      setOferta(false);
      if (!guiasPara(rol).some((x) => x.id === g.id)) return setSinPermiso(true);
      setEnCurso({ id: g.id, paso: 0 });
    };
    window.addEventListener(EVENTO_GUIA, alIniciar);
    return () => window.removeEventListener(EVENTO_GUIA, alIniciar);
    // Solo al montar: `vistas` decide la oferta inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (enCurso) sessionStorage.setItem(CLAVE, JSON.stringify(enCurso));
    else sessionStorage.removeItem(CLAVE);
  }, [enCurso]);

  const guia = enCurso ? guiaPorId(enCurso.id) : undefined;

  const salir = useCallback(() => setEnCurso(null), []);
  const terminar = useCallback(() => {
    if (enCurso) void marcarGuiaVista(enCurso.id);
    setEnCurso(null);
  }, [enCurso]);
  const avanzar = useCallback(() => {
    setEnCurso((e) => {
      if (!e) return e;
      const g = guiaPorId(e.id);
      if (!g || e.paso + 1 >= g.pasos.length) {
        void marcarGuiaVista(e.id);
        return null;
      }
      return { ...e, paso: e.paso + 1 };
    });
  }, []);
  const retroceder = useCallback(() => setEnCurso((e) => (e && e.paso > 0 ? { ...e, paso: e.paso - 1 } : e)), []);

  if (sinPermiso) {
    return (
      <Capa rect={null} alTocarFuera={() => setSinPermiso(false)}>
        <Globo rect={null} contador="Guía" titulo="Esta guía es para quien registra" progreso={0} sacudir={0}>
          <p>{rol === "contador" ? "Tu rol en este hogar es de solo lectura: puedes ver todo, pero no registrar ni cambiar." : "Solo un administrador del hogar puede hacer esto."}</p>
          <Botones>
            <Boton autoFocus onClick={() => setSinPermiso(false)}>
              Entendido
            </Boton>
          </Botones>
        </Globo>
      </Capa>
    );
  }

  if (oferta) {
    const cerrarOferta = () => {
      sessionStorage.setItem(CLAVE_OFERTA, "1");
      setOferta(false);
    };
    return (
      <div data-guia-motor className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgb(8_18_15/0.88)] p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="guia-oferta" className="w-full max-w-[400px] rounded-2xl bg-elevada p-6 text-center text-tinta shadow-2xl">
          <span className="mx-auto mb-3 flex w-fit">
            <CuadroIcono nombre="casa" tamano={56} />
          </span>
          <h2 id="guia-oferta" className="text-[22px] leading-7 font-bold">
            ¡Hola{nombre ? `, ${nombre}` : ""}! ¿Te muestro cómo funciona?
          </h2>
          <p className="mt-2 text-[15px] leading-[22px] text-cuerpo">
            En un minuto te enseño dónde está cada cosa. Después, cada pantalla tiene un botón «¿Cómo se usa?» que te guía paso a paso.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Boton
              autoFocus
              onClick={() => {
                cerrarOferta();
                setEnCurso({ id: "bienvenida", paso: 0 });
              }}
            >
              Empezar el recorrido
            </Boton>
            <Boton
              variante="fantasma"
              onClick={() => {
                cerrarOferta();
                void marcarGuiaVista("bienvenida");
              }}
            >
              Ahora no
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  if (!guia || !enCurso) return null;
  return (
    <Escena
      key={`${guia.id}:${enCurso.paso}`}
      guia={guia}
      indice={enCurso.paso}
      alAvanzar={avanzar}
      alRetroceder={retroceder}
      alSalir={salir}
      alTerminar={terminar}
    />
  );
}

type PropsEscena = {
  guia: Guia;
  indice: number;
  alAvanzar: () => void;
  alRetroceder: () => void;
  alSalir: () => void;
  alTerminar: () => void;
};

function Escena({ guia, indice, alAvanzar, alRetroceder, alSalir, alTerminar }: PropsEscena) {
  const paso = guia.pasos[indice];
  const router = useRouter();
  const [vista, setVista] = useState<Vista>({ tipo: "buscando" });
  const [paciencia, setPaciencia] = useState(false); // el aviso «Un momento…» sale si la búsqueda tarda
  const [sacudir, setSacudir] = useState(0);
  const objetivo = useRef<Element | null>(null);

  // Cada cuadro: ¿estoy en la pantalla del paso? ¿ya apareció lo que hay que iluminar? ¿dónde está ahora?
  useEffect(() => {
    let marco = 0;
    let ultimaBusqueda = 0;
    let empujado = false;
    let desplazado = false;
    let desde = Date.now();
    let rutaLista = false;

    const tick = () => {
      const ahora = Date.now();
      const { pathname, search } = window.location;
      let nueva: Vista;

      if (paso.ruta && !coincideRuta(paso.ruta, pathname, search)) {
        rutaLista = false;
        objetivo.current = null;
        const base = paso.ruta.split("?")[0];
        if (base.endsWith("/*")) {
          nueva = ahora - desde > ESPERA_MS ? { tipo: "faltante" } : { tipo: "buscando" };
        } else {
          // Primero se enseña el camino: el enlace del menú, si está a la vista (en el celular no todos lo están).
          const enlace = pathname !== base ? buscar(`${MENU} a[href="${base}"]`) : null;
          if (enlace && !empujado) {
            objetivo.current = enlace;
            const texto = enlace.getAttribute("title") ?? enlace.textContent?.trim() ?? "";
            nueva = { tipo: "menu", rect: aRect(enlace), texto };
          } else {
            if (!empujado) {
              empujado = true;
              router.push(paso.ruta);
            }
            nueva = ahora - desde > ESPERA_MS * 2 ? { tipo: "faltante" } : { tipo: "buscando" };
          }
        }
      } else if (paso.objetivo) {
        if (!rutaLista) {
          rutaLista = true;
          desde = ahora;
        }
        if (paso.omitirSi && buscar(paso.omitirSi)) {
          alAvanzar();
          return; // la escena se reemplaza por la del paso siguiente
        }
        // Buscar en el DOM cada 250 ms; entre búsquedas solo se sigue la posición (scroll, animaciones).
        if (!objetivo.current?.isConnected || ahora - ultimaBusqueda > 250) {
          ultimaBusqueda = ahora;
          objetivo.current = buscar(paso.objetivo);
        }
        const el = objetivo.current;
        if (el) {
          if (!desplazado) {
            desplazado = true;
            const r = el.getBoundingClientRect();
            if (r.top < 80 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ block: "center", behavior: "smooth" });
          }
          nueva = { tipo: "listo", rect: aRect(el) };
        } else {
          nueva = ahora - desde > ESPERA_MS ? { tipo: "faltante" } : { tipo: "buscando" };
        }
      } else {
        objetivo.current = null;
        nueva = { tipo: "listo", rect: null };
      }

      setVista((prev) => (mismaVista(prev, nueva) ? prev : nueva));
      marco = requestAnimationFrame(tick);
    };
    marco = requestAnimationFrame(tick);
    const t = setTimeout(() => setPaciencia(true), 700);
    return () => {
      cancelAnimationFrame(marco);
      clearTimeout(t);
    };
  }, [paso, router, alAvanzar]);

  // Avance por acción: tocar lo iluminado o enviar su formulario (se escucha en captura, sin interferir).
  const avance = paso.avance ?? "siguiente";
  const listo = vista.tipo === "listo";
  useEffect(() => {
    if (!listo || avance === "siguiente") return;
    const tipo = avance === "clic" ? "click" : "submit";
    const alEvento = (e: Event) => {
      const t = objetivo.current;
      const origen = e.target;
      if (!t || !(origen instanceof Element)) return;
      const toca = tipo === "click" ? t.contains(origen) : origen.contains(t) || t.contains(origen);
      if (toca) setTimeout(alAvanzar, tipo === "click" ? 80 : 0);
    };
    document.addEventListener(tipo, alEvento, true);
    return () => document.removeEventListener(tipo, alEvento, true);
  }, [listo, avance, alAvanzar]);

  // En computador se pone el cursor en el campo iluminado (en el celular abriría el teclado y taparía el globo).
  useEffect(() => {
    if (!listo || !window.matchMedia("(pointer: fine)").matches) return;
    const control = objetivo.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
    if (control && objetivo.current?.matches("label")) control.focus({ preventScroll: true });
  }, [listo]);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alSalir();
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [alSalir]);

  const ultimo = indice === guia.pasos.length - 1;
  const contador = `${guia.titulo} · ${indice + 1} de ${guia.pasos.length}`;
  const nudge = () => setSacudir((n) => n + 1);

  if (vista.tipo === "buscando") {
    return (
      <Capa rect={null} alTocarFuera={nudge}>
        {paciencia && (
          <div className="fixed top-1/2 left-1/2 z-[82] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-elevada px-4 py-3 text-sm text-cuerpo shadow-xl">
            <span className="animate-pulse">Un momento…</span>{" "}
            <button type="button" onClick={alSalir} className="ml-2 font-semibold text-tinta underline">
              Salir de la guía
            </button>
          </div>
        )}
      </Capa>
    );
  }

  if (vista.tipo === "faltante") {
    return (
      <Capa rect={null} alTocarFuera={nudge}>
        <Globo rect={null} contador={contador} titulo={paso.titulo} sacudir={sacudir} progreso={(indice + 1) / guia.pasos.length}>
          <p>{paso.faltante ?? "No encuentro esto en la pantalla. Puede que aún no tengas datos para este paso."}</p>
          <Botones>
            <Boton variante="fantasma" onClick={alSalir}>
              Salir
            </Boton>
            {ultimo ? <Boton onClick={alTerminar}>Terminar</Boton> : <Boton onClick={alAvanzar}>Saltar este paso</Boton>}
          </Botones>
        </Globo>
      </Capa>
    );
  }

  if (vista.tipo === "menu") {
    return (
      <Capa rect={vista.rect} alTocarFuera={nudge}>
        <Globo rect={vista.rect} contador={contador} titulo={`Ve a «${vista.texto}»`} sacudir={sacudir} progreso={(indice + 0.5) / guia.pasos.length}>
          <p>Toca la opción iluminada del menú. Allí sigue la guía.</p>
          <Botones>
            <Boton variante="fantasma" onClick={alSalir}>
              Salir
            </Boton>
          </Botones>
        </Globo>
      </Capa>
    );
  }

  return (
    <Capa rect={vista.rect} alTocarFuera={nudge}>
      <Globo rect={vista.rect} contador={contador} titulo={paso.titulo} sacudir={sacudir} progreso={(indice + 1) / guia.pasos.length}>
        <p>{paso.texto}</p>
        {avance !== "siguiente" && <Pista envio={avance === "envio"} />}
        <Botones>
          <Boton variante="fantasma" onClick={alSalir}>
            Salir
          </Boton>
          {indice > 0 && (
            <Boton variante="secundario" onClick={alRetroceder}>
              Atrás
            </Boton>
          )}
          {avance === "siguiente" ? (
            <Boton autoFocus={!vista.rect} onClick={ultimo ? alTerminar : alAvanzar}>
              {ultimo ? "Terminar" : "Siguiente"}
            </Boton>
          ) : (
            <Boton variante="fantasma" onClick={alAvanzar} className="text-tenue">
              Saltar
            </Boton>
          )}
        </Botones>
      </Globo>
    </Capa>
  );
}

function Pista({ envio }: { envio?: boolean }) {
  return (
    <p className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-teja">
      <span aria-hidden className="inline-block size-2 animate-ping rounded-full bg-teja" />
      {envio ? "Completa lo que falte y toca el botón iluminado." : "Toca la zona iluminada para seguir."}
    </p>
  );
}

function Botones({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

/**
 * Oscurece todo menos `rect` con cuatro paneles alrededor del hueco, que además bloquean los toques fuera de él:
 * lo iluminado sigue siendo usable. Sin `rect`, oscurece y bloquea todo.
 */
function Capa({ rect, alTocarFuera, children }: { rect: Rect | null; alTocarFuera: () => void; children: React.ReactNode }) {
  const [vw, vh] = useVentana();
  const hueco = rect && {
    top: Math.max(rect.top - RELLENO, 4),
    left: Math.max(rect.left - RELLENO, 4),
    right: Math.min(rect.left + rect.width + RELLENO, vw - 4),
    bottom: Math.min(rect.top + rect.height + RELLENO, vh - 4),
  };
  // Los paneles oscurecen y bloquean a la vez (una sombra gigante no se pinta igual en todos los celulares).
  const bloqueo = "fixed pointer-events-auto bg-[rgb(8_18_15/0.88)] transition-all duration-200 ease-out";
  return (
    <div data-guia-motor className="pointer-events-none fixed inset-0 z-[80]">
      {hueco ? (
        <>
          <div
            aria-hidden
            className="fixed rounded-xl transition-[top,left,width,height] duration-200 ease-out"
            style={{ top: hueco.top, left: hueco.left, width: hueco.right - hueco.left, height: hueco.bottom - hueco.top }}
          >
            <div className="absolute inset-0 animate-pulse rounded-xl ring-[3px] ring-teja" />
          </div>
          <div className={bloqueo} style={{ top: 0, left: 0, right: 0, height: hueco.top }} onClick={alTocarFuera} />
          <div className={bloqueo} style={{ top: hueco.bottom, left: 0, right: 0, bottom: 0 }} onClick={alTocarFuera} />
          <div className={bloqueo} style={{ top: hueco.top, left: 0, width: hueco.left, height: hueco.bottom - hueco.top }} onClick={alTocarFuera} />
          <div className={bloqueo} style={{ top: hueco.top, left: hueco.right, right: 0, height: hueco.bottom - hueco.top }} onClick={alTocarFuera} />
        </>
      ) : (
        <div className={cx(bloqueo, "inset-0")} onClick={alTocarFuera} />
      )}
      {children}
    </div>
  );
}

function useVentana(): [number, number] {
  const [t, setT] = useState<[number, number]>([1024, 768]);
  useLayoutEffect(() => {
    const medir = () => setT([window.innerWidth, window.innerHeight]);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return t;
}

/** El globo con la explicación: debajo de lo iluminado si cabe, si no encima, y si no, abajo de la pantalla. */
function Globo({
  rect,
  contador,
  titulo,
  progreso,
  sacudir,
  children,
}: {
  rect: Rect | null;
  contador: string;
  titulo: string;
  progreso: number;
  sacudir: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(220);
  const [vw, vh] = useVentana();
  // Se mide el alto real (cambia con el texto de cada paso) para decidir si cabe debajo de lo iluminado.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAlto(el.offsetHeight);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  // Al tocar fuera de lo iluminado el globo se sacude: «aquí está lo que hay que hacer».
  useEffect(() => {
    if (!sacudir || !ref.current) return;
    ref.current.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 260 });
  }, [sacudir]);

  const ancho = Math.min(380, vw - MARGEN * 2);
  let estilo: React.CSSProperties;
  if (!rect) {
    estilo = { top: Math.max(MARGEN, (vh - alto) / 2), left: (vw - ancho) / 2, width: ancho };
  } else {
    const left = Math.min(Math.max(rect.left + rect.width / 2 - ancho / 2, MARGEN), vw - ancho - MARGEN);
    const abajo = rect.top + rect.height + RELLENO + MARGEN;
    const arriba = rect.top - RELLENO - MARGEN - alto;
    const top = abajo + alto <= vh - MARGEN ? abajo : arriba >= MARGEN ? arriba : vh - alto - MARGEN;
    estilo = { top, left, width: ancho };
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby="guia-titulo"
      className="pointer-events-auto fixed z-[82] rounded-2xl bg-elevada p-4 text-tinta shadow-2xl transition-[top,left] duration-200 ease-out md:p-5"
      style={estilo}
    >
      <p className="text-[11px] leading-4 font-bold tracking-[0.12em] text-cuerpo uppercase">{contador}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-pista" aria-hidden>
        <div className="h-full rounded-full bg-teja transition-[width] duration-300" style={{ width: `${Math.round(progreso * 100)}%` }} />
      </div>
      <h2 id="guia-titulo" aria-live="polite" className="mt-3 text-[17px] leading-[22px] font-bold">
        {titulo}
      </h2>
      <div className="mt-1 text-[15px] leading-[22px] text-cuerpo">{children}</div>
    </div>
  );
}

