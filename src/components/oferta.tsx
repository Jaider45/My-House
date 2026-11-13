import type { ReactNode } from "react";

/** Banner de oferta o aviso (diseño «Ofertas y enlaces → Así se ve en la app»). */
export function BannerOferta({ etiqueta, titulo, texto, boton, cerrar }: { etiqueta: string; titulo: string; texto: string; boton?: ReactNode; cerrar?: ReactNode }) {
  return (
    <section aria-label={etiqueta} className="relative flex flex-wrap items-center gap-3.5 rounded-2xl bg-monte p-4 text-arena md:flex-nowrap">
      <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-alerta-fondo px-2.5 text-xs font-bold text-alerta-tinta">{etiqueta}</span>
      <div className="min-w-0 flex-1">
        <b className="text-base">{titulo}</b>
        {texto && <p className="text-[13px] text-sobre-monte">{texto}</p>}
      </div>
      {boton}
      {cerrar}
    </section>
  );
}
