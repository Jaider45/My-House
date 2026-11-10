import { hoy, sumarDias, ZONA } from "@/lib/fechas";

const hora = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit", hour12: true });
const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "numeric", month: "short", year: "numeric" });

/** «8:14 a. m.» con espacios normales (Intl usa espacios finos que algunos navegadores muestran raros). */
const limpiar = (s: string) => s.replace(/[  ]/g, " ").replace(/ de /g, " ");

/**
 * Momento legible en hora de Bogotá, como en el diseño de la consola: «Hoy, 8:14 a. m.», «Ayer, 6:30 p. m.» o
 * «4 nov 2026, 9:02 a. m.». `null` → «—».
 */
export function formatearMomento(iso: string | null | undefined, ahora: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = hoy(d);
  const h = limpiar(hora.format(d));
  if (dia === hoy(ahora)) return `Hoy, ${h}`;
  if (dia === sumarDias(hoy(ahora), -1)) return `Ayer, ${h}`;
  return `${limpiar(fecha.format(d))}, ${h}`;
}

/** Solo la fecha: «4 nov 2026». */
export function formatearFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : limpiar(fecha.format(d));
}
