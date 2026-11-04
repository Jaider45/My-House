/**
 * Fechas de gastos recurrentes. Debe coincidir con private.siguiente_fecha() en SQL:
 * la ocurrencia n se cuenta desde el inicio (no se acumula), y si el día no existe en el mes
 * se usa el último día (31 de enero + 1 mes = 28 de febrero; + 2 meses = 31 de marzo).
 */
export const FRECUENCIAS = ["semanal", "quincenal", "mensual", "bimestral", "trimestral", "semestral", "anual"] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];

export const ETIQUETA_FRECUENCIA: Record<Frecuencia, string> = {
  semanal: "Cada semana",
  quincenal: "Cada 15 días",
  mensual: "Cada mes",
  bimestral: "Cada 2 meses",
  trimestral: "Cada 3 meses",
  semestral: "Cada 6 meses",
  anual: "Cada año",
};

const MESES: Partial<Record<Frecuencia, number>> = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
const DIAS: Partial<Record<Frecuencia, number>> = { semanal: 7, quincenal: 15 };

const dos = (n: number) => String(n).padStart(2, "0");

export function fechaOcurrencia(inicio: string, frecuencia: Frecuencia, n: number): string {
  const [a, m, d] = inicio.split("-").map(Number);
  const dias = DIAS[frecuencia];
  if (dias) {
    const f = new Date(Date.UTC(a, m - 1, d + dias * n));
    return f.toISOString().slice(0, 10);
  }
  const total = a * 12 + (m - 1) + MESES[frecuencia]! * n;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${dos(mes)}-${dos(Math.min(d, ultimo))}`;
}

/** Primera ocurrencia en o después de `desde`: con ella arranca la programación de una regla. */
export function primeraDesde(inicio: string, frecuencia: Frecuencia, desde: string): { ocurrencias: number; fecha: string } {
  for (let n = 0; n < 10_000; n++) {
    const fecha = fechaOcurrencia(inicio, frecuencia, n);
    if (fecha >= desde) return { ocurrencias: n, fecha };
  }
  throw new Error("Fecha de inicio demasiado antigua");
}

/** Equivalente mensual de una regla (para estimar el gasto fijo del mes). */
export function montoMensual(monto: number, frecuencia: Frecuencia): number {
  const factor: Record<Frecuencia, number> = {
    semanal: 52 / 12,
    quincenal: 365 / 15 / 12,
    mensual: 1,
    bimestral: 1 / 2,
    trimestral: 1 / 3,
    semestral: 1 / 6,
    anual: 1 / 12,
  };
  return Math.round(monto * factor[frecuencia]);
}
