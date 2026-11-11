/**
 * Precios de los modelos de IA (consola → IA): «modelo: entrada, salida» en dólares por millón de tokens. El modelo
 * es un prefijo (`claude-opus` vale para todas sus versiones; gana el más largo que calce).
 */

export type Precios = Record<string, [number, number]>;

export function leerPrecios(texto: string): { precios: Precios } | { error: string } {
  const precios: Precios = {};
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, linea] of lineas.entries()) {
    const m = linea.match(/^([a-z0-9.\-]{2,60})\s*[:=]\s*([\d.]+)\s*[,;/ ]\s*([\d.]+)$/i);
    if (!m) return { error: `Línea ${i + 1}: escribe «modelo: entrada, salida» (ej.: claude-opus: 5, 25).` };
    const [entrada, salida] = [Number(m[2]), Number(m[3])];
    if (!Number.isFinite(entrada) || !Number.isFinite(salida)) return { error: `Línea ${i + 1}: los precios son números.` };
    precios[m[1].toLowerCase()] = [entrada, salida];
  }
  return { precios };
}

export function preciosATexto(p: Precios): string {
  return Object.entries(p)
    .map(([modelo, [e, s]]) => `${modelo}: ${e}, ${s}`)
    .join("\n");
}
