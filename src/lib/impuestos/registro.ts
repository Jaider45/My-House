import { colombia } from "./co";
import type { JurisdiccionTributaria, ResultadoTope, Semaforo } from "./tipos";

const JURISDICCIONES: Record<string, JurisdiccionTributaria> = { CO: colombia };

export function jurisdiccion(pais: string): JurisdiccionTributaria | undefined {
  return JURISDICCIONES[pais.toUpperCase()];
}

/** El peor estado de un conjunto de topes (rojo > amarillo > verde). */
export function peorSemaforo(resultados: ResultadoTope[]): Semaforo {
  if (resultados.some((r) => r.semaforo === "rojo")) return "rojo";
  if (resultados.some((r) => r.semaforo === "amarillo")) return "amarillo";
  return "verde";
}
