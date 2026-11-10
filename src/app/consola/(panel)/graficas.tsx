import { cx } from "@/components/ui";

/*
 * Gráficas de la consola, como en el diseño Admin: barras CSS sin librerías (una librería de gráficas sumaría
 * cientos de KB al navegador para cuatro barras). Son componentes de servidor: no mandan JS.
 */

export type Punto = { etiqueta: string; valor: number; detalle?: string; destacar?: boolean };

/** Barras verticales con eje simple. `alto` en píxeles. */
export function Barras({ datos, alto = 200, formato = (v: number) => v.toLocaleString("es-CO") }: { datos: Punto[]; alto?: number; formato?: (v: number) => string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <div className="flex items-end gap-1.5" style={{ height: alto }} role="img" aria-label={datos.map((d) => `${d.etiqueta}: ${formato(d.valor)}`).join(" · ")}>
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch" title={`${d.detalle ?? d.etiqueta}: ${formato(d.valor)}`}>
          <div
            className={cx("w-full max-w-9 rounded-t-md", d.destacar ? "bg-teja" : "bg-monte")}
            style={{ height: `${Math.max(d.valor > 0 ? 2 : 0, Math.round((d.valor / max) * 88))}%` }}
          />
          <span className="max-w-full truncate text-[11px] text-tenue">{d.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

/** Embudo horizontal: cada paso con su barra y porcentaje sobre el primero. */
export function Embudo({ pasos }: { pasos: { texto: string; valor: number }[] }) {
  const base = Math.max(1, pasos[0]?.valor ?? 1);
  return (
    <div className="flex flex-col gap-2.5">
      {pasos.map((p) => {
        const pct = Math.round((p.valor / base) * 100);
        return (
          <div key={p.texto} className="grid grid-cols-[minmax(110px,160px)_minmax(0,1fr)_72px] items-center gap-3 text-sm">
            <span className="text-cuerpo">{p.texto}</span>
            <div className="h-7 overflow-hidden rounded-md bg-pista">
              <div className="flex h-full items-center rounded-md bg-monte px-2 text-[13px] font-bold text-arena" style={{ width: `${Math.max(pct, 7)}%` }}>
                {p.valor.toLocaleString("es-CO")}
              </div>
            </div>
            <b className="text-right">{pct} %</b>
          </div>
        );
      })}
    </div>
  );
}
