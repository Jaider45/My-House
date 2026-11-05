import type { CSSProperties } from "react";
import { ICONOS, TRAZOS } from "./marca-datos";

export type NombreIcono = keyof typeof ICONOS;

type PropsIcono = {
  nombre: NombreIcono;
  tamano?: number;
  /** Relleno para el ítem activo de la navegación; línea en el resto. */
  relleno?: boolean;
  /** Pinta el trazo de acento en teja. Apagar sobre fondos de color. */
  acento?: boolean;
  etiqueta?: string;
  className?: string;
};

/**
 * Ícono del sistema My House. Las máscaras de la versión rellena tienen id fijo por nombre: si el mismo ícono
 * aparece dos veces, ambas copias definen la misma máscara y el resultado es idéntico.
 */
export function Icono({ nombre, tamano = 24, relleno, acento = true, etiqueta, className }: PropsIcono) {
  const def = ICONOS[nombre];
  const estilo = (acento ? { "--mh-acento": "var(--color-teja)" } : {}) as CSSProperties;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className ?? ""}`}
      style={estilo}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      dangerouslySetInnerHTML={{ __html: relleno ? def.relleno : def.linea }}
    />
  );
}

/** Logo horizontal (isotipo + "my house") o solo isotipo. Colores de marca; en negativo para fondos verde monte. */
export function Logo({ forma = "horizontal", alto = 32, negativo }: { forma?: "horizontal" | "isotipo"; alto?: number; negativo?: boolean }) {
  const caja = forma === "isotipo" ? [256, 256] : [868, 256];
  const tinta = negativo ? "var(--color-arena)" : "var(--color-monte)";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${caja[0]} ${caja[1]}`}
      height={alto}
      width={Math.round((alto * caja[0]) / caja[1])}
      role="img"
      aria-label="My House"
      className="block shrink-0"
    >
      <path d={TRAZOS.P1} style={{ fill: tinta }} />
      <path d={TRAZOS.P2} style={{ fill: "var(--color-teja)" }} />
      {forma === "horizontal" && <path d={TRAZOS.W} style={{ fill: tinta }} />}
    </svg>
  );
}
