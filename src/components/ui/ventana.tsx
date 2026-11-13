"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cx } from ".";
import { BotonEnviar } from "./boton-enviar";
import type { Estado } from "@/lib/acciones";

const Contexto = createContext<{ cerrar: () => void } | null>(null);

/** Cierra la ventana en la que vive el formulario (null fuera de una ventana). */
export const useVentana = () => useContext(Contexto);

/**
 * Ventana de crear (diseño «Crear según la sección»): centrada en laptop y escritorio, hoja que sube desde abajo en
 * celular y tablet. Se abre con el parámetro `?nuevo=1` en la URL: así el botón «Nueva deuda», el botón flotante,
 * los accesos de Inicio y las guías interactivas llegan al mismo lugar, y Atrás la cierra.
 */
export function Ventana({
  titulo,
  subtitulo,
  children,
  valor = "1",
  ancho = 600,
  guia,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  /** Valor de `nuevo` que la abre (para pantallas con más de una ventana). */
  valor?: string;
  ancho?: number;
  /** Marca para las guías interactivas (`data-guia`). */
  guia?: string;
}) {
  const parametros = useSearchParams();
  const abierta = parametros.get("nuevo") === valor;
  const router = useRouter();
  const ruta = usePathname();
  const cerrar = useCallback(() => {
    const q = new URLSearchParams(parametros.toString());
    q.delete("nuevo");
    const resto = q.toString();
    router.replace(resto ? `${ruta}?${resto}` : ruta, { scroll: false });
  }, [parametros, router, ruta]);
  if (!abierta) return null;
  return (
    <MarcoVentana titulo={titulo} subtitulo={subtitulo} ancho={ancho} guia={guia} alCerrar={cerrar}>
      {children}
    </MarcoVentana>
  );
}

/**
 * Lo visual de la ventana (fondo oscuro, caja, encabezado con cerrar) para quien maneja su propia apertura, como
 * Registrar (una ruta, no un parámetro). Escape y el fondo cierran.
 */
export function MarcoVentana({
  titulo,
  subtitulo,
  children,
  ancho = 600,
  guia,
  alCerrar,
  accionesTitulo,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  ancho?: number;
  guia?: string;
  alCerrar: () => void;
  /** Botones junto al de cerrar (p. ej. «¿Cómo se usa?»). */
  accionesTitulo?: ReactNode;
}) {
  const idTitulo = useId();
  const caja = useRef<HTMLElement>(null);
  const valorContexto = useMemo(() => ({ cerrar: alCerrar }), [alCerrar]);

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco al primer campo (en computador; en celular el teclado taparía la hoja recién abierta).
    if (window.matchMedia("(pointer: fine)").matches && !caja.current?.contains(document.activeElement))
      caja.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
    const tecla = (e: KeyboardEvent) => {
      // Si hay una guía en curso, Escape es para salir de ella (el motor lo escucha).
      if (e.key === "Escape" && !document.querySelector("[data-guia-motor]")) alCerrar();
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", tecla);
    };
  }, [alCerrar]);

  return (
    <Contexto.Provider value={valorContexto}>
      <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-start lg:overflow-y-auto lg:px-6 lg:py-[72px]">
        <div className="fixed inset-0 bg-[rgba(20,61,51,0.5)]" onClick={alCerrar} aria-hidden />
        <section
          ref={caja}
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          data-guia={guia}
          style={{ ["--ancho" as string]: `${ancho}px` }}
          className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-elevada text-tinta shadow-[0_24px_64px_rgba(20,61,51,0.28)] md:w-[640px] lg:max-h-none lg:w-[var(--ancho)] lg:max-w-full lg:rounded-[20px]"
        >
          <span className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-pista lg:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2 md:px-6 lg:pt-5">
            <div className="min-w-0">
              <h2 id={idTitulo} className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">
                {titulo}
              </h2>
              {subtitulo && <p className="mt-1 text-sm text-tenue">{subtitulo}</p>}
            </div>
            <span className="flex shrink-0 items-center gap-1">
              {accionesTitulo}
              <button type="button" onClick={alCerrar} aria-label="Cerrar" className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-mosaico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 md:px-6 lg:overflow-visible">{children}</div>
        </section>
      </div>
    </Contexto.Provider>
  );
}

/**
 * Pie de la ventana: Cancelar + guardar, separado por una línea y pegado abajo en la hoja del celular. Fuera de una
 * ventana es solo el botón de guardar.
 */
export function PieVentana({ children, pendiente, className }: { children: ReactNode; pendiente?: string; className?: string }) {
  const ventana = useVentana();
  if (!ventana) return <BotonEnviar pendiente={pendiente}>{children}</BotonEnviar>;
  return (
    <div
      className={cx(
        "sticky bottom-0 -mx-5 mt-2 flex items-center justify-end gap-3 border-t border-divisor bg-elevada px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 lg:static",
        className,
      )}
    >
      <button type="button" onClick={ventana.cerrar} className="inline-flex h-10 items-center rounded-lg px-4 text-[15px] font-semibold hover:bg-mosaico">
        Cancelar
      </button>
      <BotonEnviar pendiente={pendiente} className="min-w-40">
        {children}
      </BotonEnviar>
    </div>
  );
}

/** Cierra la ventana cuando la acción responde «listo» (la lista de la pantalla ya se refrescó con revalidatePath). */
export function useCerrarAlGuardar(estado: Estado) {
  const ventana = useVentana();
  useEffect(() => {
    if (estado?.ok) ventana?.cerrar();
  }, [estado, ventana]);
}
