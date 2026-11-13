/*
 * TRM (tasa representativa del mercado, pesos por dólar). La oficial la certifica la Superintendencia Financiera y
 * se publica en datos.gov.co (conjunto 32sa-8pi3); el cron la guarda cada día en la tabla `trm`. Funciones puras.
 */

export type FilaTrm = { valor: string | number; vigenciadesde: string; vigenciahasta?: string };

/** Lee la respuesta de datos.gov.co: la fila vigente más reciente como { fecha, valor }. null si no sirve. */
export function leerTrm(filas: unknown): { fecha: string; valor: number } | null {
  if (!Array.isArray(filas) || !filas.length) return null;
  const f = filas[0] as FilaTrm;
  const valor = Number(f.valor);
  const fecha = String(f.vigenciadesde ?? "").slice(0, 10);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100_000 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return { fecha, valor: Math.round(valor * 100) / 100 };
}

/** Dólares (con centavos) a pesos enteros con la TRM: `Math.round` (nunca float para montos guardados). */
export function dolaresAPesos(dolares: number, trm: number): number {
  return Math.round(dolares * trm);
}

/** «$ 3.874,52» */
export function formatearTrm(valor: number): string {
  return `$ ${valor.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
