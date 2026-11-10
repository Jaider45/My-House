import type { ReactNode } from "react";
import { cx } from "@/components/ui";

/** Panel con encabezado y una tabla de borde a borde (como «Totales por etiqueta» en Renta DIAN). */
export function TarjetaTabla({
  titulo,
  subtitulo,
  accion,
  children,
  pie,
  className,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("min-w-0 overflow-hidden rounded-2xl border border-borde bg-elevada pb-2 text-tinta", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
        <div>
          <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-sm text-tenue">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
      {pie && <div className="px-4 pt-3 pb-2 md:px-6">{pie}</div>}
    </section>
  );
}
