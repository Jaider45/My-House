/** Dinero en pesos enteros (COP). Nunca float para guardar montos. */

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatoNumero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** 1234567 → "$ 1.234.567" */
export function formatearCOP(pesos: number): string {
  return formatoCOP.format(pesos);
}

/** 1234567 → "1.234.567" (para inputs). */
export function formatearMiles(pesos: number): string {
  return formatoNumero.format(pesos);
}

const formatoDecimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** Etiqueta corta para ejes y calendarios: 15000000 → "$15 M", 1250000 → "$1,3 M", 450000 → "$450 mil". */
export function formatearCorto(pesos: number): string {
  const signo = pesos < 0 ? "−" : "";
  const n = Math.abs(pesos);
  if (n >= 1_000_000) return `${signo}$${formatoDecimal.format(n / 1_000_000)} M`;
  if (n >= 1_000) return `${signo}$${Math.round(n / 1_000)} mil`;
  return `${signo}$${n}`;
}

/** Para el teclado del registro rápido: conserva solo dígitos. "1.234.5a" → 12345 */
export function digitosAMonto(texto: string): number {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "");
  return digitos ? Number(digitos.slice(0, 15)) : 0;
}

/**
 * Interpreta montos como vienen en extractos: "1.234.567", "1,234,567.00", "-45.000,50",
 * "(12.000)", "$ 3.500-". Devuelve pesos enteros con signo, o null si no es un número.
 * Regla de separadores: si tras el último separador hay 1–2 dígitos es decimal; si hay 3, es de miles.
 */
export function parsearMonto(texto: string): number | null {
  let t = texto.trim();
  if (!t) return null;

  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[^\d.,-]/g, "");
  if (!/^-?[\d.,]*-?$/.test(t)) return null;
  if (t.startsWith("-")) negativo = !negativo;
  if (t.endsWith("-") && t.length > 1) negativo = !negativo;
  t = t.replace(/-/g, "");
  if (!/\d/.test(t) || !/^[\d.,]+$/.test(t)) return null;

  const ultimo = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
  let entero = t;
  let decimales = "";
  if (ultimo >= 0) {
    const cola = t.slice(ultimo + 1);
    if (cola.length >= 1 && cola.length <= 2) {
      entero = t.slice(0, ultimo);
      decimales = cola;
    }
  }
  entero = entero.replace(/[.,]/g, "") || "0";
  const valor = Math.round(Number(`${entero}.${decimales || "0"}`));
  if (!Number.isSafeInteger(valor)) return null;
  return negativo && valor !== 0 ? -valor : valor;
}

/** Porcentaje entero redondeado; 0 si el total es 0. */
export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte * 100) / total) : 0;
}
