/**
 * Fechas como texto ISO "YYYY-MM-DD" (igual que el tipo date de Postgres) para no depender de la zona
 * horaria del servidor. "Hoy" siempre es hoy en Bogotá.
 */

export const ZONA = "America/Bogota";

const formatoISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hoy(ahora: Date = new Date()): string {
  return formatoISO.format(ahora);
}

/** "2026-11-04" → "2026-11" */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

const dos = (n: number) => String(n).padStart(2, "0");

/** "2026-02" → { desde: "2026-02-01", hasta: "2026-02-28" } */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, hasta: `${mes}-${dos(diasDelMes(anio, m))}` };
}

/** Suma meses a "YYYY-MM". sumarMeses("2026-01", -1) → "2025-12" */
export function sumarMeses(mes: string, n: number): string {
  const [anio, m] = mes.split("-").map(Number);
  const total = anio * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${dos((total % 12) + 1)}`;
}

/**
 * Fechas de extractos: "2026-11-04", "2026/11/04", "04/11/2026", "4-11-2026", "04/11/26".
 * Orden día/mes (Colombia). Devuelve ISO o null si no es una fecha válida.
 */
export function parsearFecha(texto: string): string | null {
  const t = texto.trim().split(/[ T]/)[0];
  let anio: number, mes: number, dia: number;

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) {
    [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(t);
    if (!m) return null;
    [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (anio < 100) anio += 2000;
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) return null;
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

const formatoCorto = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatoMes = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-11-04" → "4 de nov de 2026" */
export function formatearFecha(fecha: string): string {
  return formatoCorto.format(new Date(`${fecha}T00:00:00Z`)).replace(/\./g, "");
}

/** "2026-11" → "noviembre de 2026" */
export function formatearMes(mes: string): string {
  return formatoMes.format(new Date(`${mes}-01T00:00:00Z`));
}
