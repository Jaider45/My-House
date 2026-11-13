"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cx } from "@/components/ui";

type Opcion = { valor: string; texto: string };
export type Filtro = { nombre: string; etiqueta: string; opciones: Opcion[] };

/** Cambia un parámetro de la URL (vacío = lo quita) y navega: la lista se vuelve a pedir al servidor. */
function useParametro() {
  const router = useRouter();
  const ruta = usePathname();
  const actuales = useSearchParams();
  return (nombre: string, valor: string) => {
    const q = new URLSearchParams(actuales.toString());
    if (valor) q.set(nombre, valor);
    else q.delete(nombre);
    router.push(`${ruta}?${q.toString()}`, { scroll: false });
  };
}

/** Ficha con menú (diseño «Movimientos»: «Categoría ▾», «Estado: todos menos programados ▾»). */
function Ficha({ filtro, valor }: { filtro: Filtro; valor: string }) {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const cambiar = useParametro();
  const elegida = filtro.opciones.find((o) => o.valor === valor);
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierta(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierta]);
  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierta}
        onClick={() => setAbierta(!abierta)}
        className={cx(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap",
          valor ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico",
        )}
      >
        {elegida && valor ? `${filtro.etiqueta}: ${elegida.texto.toLowerCase()}` : filtro.etiqueta}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierta && (
        <ul role="listbox" aria-label={filtro.etiqueta} className="absolute top-11 left-0 z-30 max-h-80 min-w-56 overflow-y-auto rounded-xl border border-borde bg-elevada p-1 shadow-lg">
          {filtro.opciones.map((o) => (
            <li key={o.valor}>
              <button
                type="button"
                role="option"
                aria-selected={o.valor === valor}
                onClick={() => {
                  setAbierta(false);
                  cambiar(filtro.nombre, o.valor);
                }}
                className={cx("flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-mosaico", o.valor === valor && "font-bold")}
              >
                {o.texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Segmento Todos / Personal / Negocio. */
export function SegmentoAmbito({ valor }: { valor: string }) {
  const cambiar = useParametro();
  return (
    <div role="radiogroup" aria-label="Ámbito" className="inline-flex shrink-0 gap-1 rounded-[10px] bg-mosaico p-1">
      {[
        ["", "Todos"],
        ["personal", "Personal"],
        ["negocio", "Negocio"],
      ].map(([v, t]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => cambiar("ambito", v)}
          className={cx("h-8 rounded-lg px-3 text-sm font-semibold", valor === v ? "bg-elevada shadow-sm" : "text-cuerpo")}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function FichasFiltro({ filtros, valores }: { filtros: Filtro[]; valores: Record<string, string> }) {
  return (
    <>
      {filtros.map((f) => (
        <Ficha key={f.nombre} filtro={f} valor={valores[f.nombre] ?? ""} />
      ))}
    </>
  );
}
