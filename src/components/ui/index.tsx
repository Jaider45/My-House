import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icono, type NombreIcono } from "@/components/marca";

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

export const estilosBoton = {
  primario:
    "border-transparent bg-monte text-arena hover:bg-monte/90 disabled:opacity-50",
  secundario:
    "bg-elevada text-tinta border-cuerpo hover:bg-mosaico disabled:opacity-50",
  fantasma:
    "border-transparent bg-transparent text-tinta hover:bg-mosaico disabled:opacity-50",
  peligro:
    "bg-elevada text-error-tinta border-error-tinta hover:bg-error-fondo disabled:opacity-50",
} as const;

export function clasesBoton(
  variante: keyof typeof estilosBoton = "primario",
  extra?: string,
) {
  return cx(
    "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 text-[15px] font-semibold transition disabled:cursor-not-allowed",
    estilosBoton[variante],
    extra,
  );
}

export function Boton({
  variante = "primario",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: keyof typeof estilosBoton }) {
  return <button className={clasesBoton(variante, className)} {...props} />;
}

export function EnlaceBoton({
  variante = "primario",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: keyof typeof estilosBoton }) {
  return <Link className={clasesBoton(variante, className)} {...props} />;
}

export const claseControl =
  "block h-11 w-full rounded-lg border border-control bg-elevada px-3 text-[15px] text-tinta outline-none focus:border-monte focus:ring-2 focus:ring-monte/15";
const claseEtiqueta = "text-[13px] font-semibold leading-[18px] text-cuerpo";

export function Campo({
  etiqueta,
  ayuda,
  className,
  ...props
}: ComponentProps<"input"> & { etiqueta: string; ayuda?: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className={claseEtiqueta}>{etiqueta}</span>
      <input className={claseControl} {...props} />
      {ayuda && (
        <span className="text-[13px] leading-[18px] text-tenue">{ayuda}</span>
      )}
    </label>
  );
}

export function Selector({
  etiqueta,
  children,
  className,
  ...props
}: ComponentProps<"select"> & { etiqueta: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className={claseEtiqueta}>{etiqueta}</span>
      <select className={claseControl} {...props}>
        {children}
      </select>
    </label>
  );
}

export function AreaTexto({
  etiqueta,
  className,
  ...props
}: ComponentProps<"textarea"> & { etiqueta: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className={claseEtiqueta}>{etiqueta}</span>
      <textarea
        className={cx(claseControl, "h-auto py-2")}
        rows={3}
        {...props}
      />
    </label>
  );
}

export function Casilla({
  etiqueta,
  ...props
}: ComponentProps<"input"> & { etiqueta: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-[15px]">
      <input type="checkbox" className="size-[18px] accent-monte" {...props} />
      {etiqueta}
    </label>
  );
}

/** Panel blanco con borde sutil. Con título: encabezado h2 + subtítulo + acción a la derecha. */
export function Tarjeta({
  titulo,
  subtitulo,
  accion,
  children,
  className,
  id,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cx(
        "scroll-mt-4 rounded-2xl border border-borde bg-elevada p-4 text-tinta md:p-6",
        className,
      )}
    >
      {(titulo || accion) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && (
              <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">
                {titulo}
              </h2>
            )}
            {subtitulo && (
              <p className="mt-0.5 text-sm text-tenue">{subtitulo}</p>
            )}
          </div>
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Aviso({
  tipo = "error",
  children,
}: {
  tipo?: "error" | "ok" | "info";
  children: ReactNode;
}) {
  const colores = {
    error: "bg-error-fondo text-error-tinta",
    ok: "bg-ok-fondo text-ok-tinta",
    info: "bg-seleccion text-tinta",
  };
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={cx("rounded-xl px-4 py-3 text-sm", colores[tipo])}
    >
      {children}
    </p>
  );
}

export type Tono = "ok" | "alerta" | "error" | "info" | "neutro";

export function Chip({
  tono = "neutro",
  plano,
  children,
}: {
  tono?: Tono;
  plano?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "chip",
        tono !== "neutro" && `chip-${tono}`,
        plano && "chip-plano",
      )}
    >
      {children}
    </span>
  );
}

const colorBarra: Record<Tono | "marca" | "teja", string> = {
  ok: "bg-ok",
  alerta: "bg-alerta",
  error: "bg-error",
  info: "bg-cuerpo",
  neutro: "bg-cuerpo",
  marca: "bg-monte",
  teja: "bg-teja",
};

/** Barra de avance; `porcentaje` se recorta a 0–100. */
export function Barra({
  porcentaje,
  tono = "ok",
  gruesa,
}: {
  porcentaje: number;
  tono?: keyof typeof colorBarra;
  gruesa?: boolean;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-full bg-pista",
        gruesa ? "h-3" : "h-2",
      )}
    >
      <div
        className={cx("h-full rounded-full", colorBarra[tono])}
        style={{ width: `${Math.max(0, Math.min(100, porcentaje))}%` }}
      />
    </div>
  );
}

/**
 * Encabezado de vista: título, subtítulo (oculto en celular) y acciones. En laptop y escritorio suma el botón
 * Registrar (en celular y tablet lo reemplaza el botón flotante).
 */
export function Titulo({
  children,
  subtitulo,
  accion,
  registrar = true,
}: {
  children: ReactNode;
  subtitulo?: ReactNode;
  accion?: ReactNode;
  registrar?: boolean;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center gap-3 md:mb-5 md:gap-4">
      <div className="min-w-0 flex-[1_1_320px]">
        <h1 className="text-[22px] leading-7 font-bold first-letter:uppercase md:text-[28px] md:leading-[34px]">
          {children}
        </h1>
        {subtitulo && (
          <p className="mt-1 hidden text-base text-cuerpo md:block">
            {subtitulo}
          </p>
        )}
      </div>
      {(accion || registrar) && (
        <div className="flex flex-wrap items-center gap-3">
          {accion}
          {registrar && (
            <span className="hidden lg:contents">
              <EnlaceBoton href="/rapido">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Registrar
              </EnlaceBoton>
            </span>
          )}
        </div>
      )}
    </header>
  );
}

/** Indicador del mes. `clave` lo pinta en verde monte (el número que importa). */
export function Kpi({
  icono,
  etiqueta,
  valor,
  detalle,
  clave,
}: {
  icono: NombreIcono;
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  clave?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1 rounded-2xl border p-3.5 md:gap-1.5 md:px-6 md:py-5",
        clave ? "border-monte bg-monte" : "border-borde bg-elevada",
      )}
    >
      <div
        className={cx(
          "flex items-center gap-2 text-xs leading-4 font-semibold md:text-sm md:leading-5",
          clave ? "text-sobre-monte" : "text-cuerpo",
        )}
      >
        <Icono nombre={icono} tamano={20} acento={!clave} />
        {etiqueta}
      </div>
      <div
        className={cx(
          "truncate text-[19px] leading-[26px] font-bold md:text-[28px] md:leading-[34px]",
          clave ? "text-arena" : "text-tinta",
        )}
      >
        {valor}
      </div>
      {detalle && (
        <div
          className={cx(
            "text-[13px] leading-[18px]",
            clave ? "text-sobre-monte" : "text-tenue",
          )}
        >
          {detalle}
        </div>
      )}
    </div>
  );
}

/** Selector de mes con flechas (enlaces). */
export function SelectorMes({
  etiqueta,
  anterior,
  siguiente,
}: {
  etiqueta: string;
  anterior: string;
  siguiente?: string;
}) {
  const flecha =
    "inline-flex size-9 items-center justify-center rounded-lg text-tinta hover:bg-mosaico";
  return (
    <div
      role="group"
      aria-label="Mes"
      className="inline-flex items-center gap-1 rounded-[10px] border border-borde bg-elevada p-0.5"
    >
      <Link href={anterior} className={flecha} aria-label="Mes anterior">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <span className="min-w-32 text-center text-[15px] font-semibold first-letter:uppercase">
        {etiqueta}
      </span>
      {siguiente ? (
        <Link href={siguiente} className={flecha} aria-label="Mes siguiente">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      ) : (
        <span className="size-9" aria-hidden />
      )}
    </div>
  );
}

/** Ícono de categoría en su cuadro arena. */
export function CuadroIcono({
  nombre,
  tamano = 36,
}: {
  nombre: NombreIcono;
  tamano?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-mosaico text-tinta"
      style={{ width: tamano, height: tamano }}
    >
      <Icono nombre={nombre} tamano={tamano >= 36 ? 20 : 18} />
    </span>
  );
}

/** Fila de lista: ícono, título, detalle y valor. */
export function FilaLista({
  icono,
  titulo,
  detalle,
  valor,
}: {
  icono?: NombreIcono;
  titulo: ReactNode;
  detalle?: ReactNode;
  valor?: ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 border-b border-divisor py-3 last:border-b-0">
      {icono && <CuadroIcono nombre={icono} tamano={40} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-5 font-semibold">
          {titulo}
        </span>
        {detalle && (
          <span className="text-[13px] leading-[18px] text-tenue">
            {detalle}
          </span>
        )}
      </span>
      {valor != null && (
        <span className="text-[15px] leading-5 font-bold whitespace-nowrap">
          {valor}
        </span>
      )}
    </div>
  );
}

export function Cargando({
  texto = "Cargando…",
  compacto,
}: {
  texto?: string;
  compacto?: boolean;
}) {
  if (compacto)
    return (
      <p className="animate-pulse py-6 text-center text-sm text-tenue">
        {texto}
      </p>
    );
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-2xl border border-borde bg-elevada p-5"
          >
            <div className="esqueleto h-3.5 w-1/2" />
            <div className="esqueleto h-7 w-3/4" />
          </div>
        ))}
      </div>
      <div className="esqueleto h-48 w-full rounded-2xl" />
      <p className="text-center text-[13px] text-tenue">{texto}</p>
    </div>
  );
}

/** Estado vacío: ícono, título, texto y acciones. Con solo `children`, un texto corto centrado. */
export function Vacio({
  children,
  icono,
  titulo,
  acciones,
}: {
  children: ReactNode;
  icono?: NombreIcono;
  titulo?: string;
  acciones?: ReactNode;
}) {
  if (!titulo)
    return <p className="py-6 text-center text-sm text-tenue">{children}</p>;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-control bg-elevada px-6 py-14 text-center">
      {icono && (
        <span className="inline-flex size-[72px] items-center justify-center rounded-[20px] bg-mosaico text-tinta">
          <Icono nombre={icono} tamano={32} />
        </span>
      )}
      <h2 className="text-[22px] leading-7 font-bold">{titulo}</h2>
      <p className="max-w-[440px] text-[15px] leading-[22px] text-cuerpo">
        {children}
      </p>
      {acciones && (
        <div className="flex flex-wrap justify-center gap-3">{acciones}</div>
      )}
    </div>
  );
}
