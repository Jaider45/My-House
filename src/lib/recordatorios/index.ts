import { fechaOcurrencia } from "@/lib/recurrentes";

export type Repeticion = "una_vez" | "mensual" | "anual";

/**
 * Próxima fecha de un recordatorio en o después de `hoy`. Los que se repiten avanzan desde la fecha original
 * (el 31 se ajusta al último día del mes, igual que los pagos fijos). Uno de una sola vez conserva su fecha.
 */
export function proximaFecha(fecha: string, repetir: Repeticion, hoy: string): string {
  if (repetir === "una_vez" || fecha >= hoy) return fecha;
  const frecuencia = repetir === "mensual" ? "mensual" : "anual";
  for (let n = 1; n < 10_000; n++) {
    const f = fechaOcurrencia(fecha, frecuencia, n);
    if (f >= hoy) return f;
  }
  return fecha;
}

/** Días de anticipación → texto: 0 → "El mismo día", 1 → "1 día antes", 7 → "1 semana antes". */
export function textoAviso(dias: number): string {
  if (dias === 0) return "El mismo día";
  if (dias % 7 === 0) return dias === 7 ? "1 semana antes" : `${dias / 7} semanas antes`;
  if (dias === 30) return "1 mes antes";
  return dias === 1 ? "1 día antes" : `${dias} días antes`;
}
