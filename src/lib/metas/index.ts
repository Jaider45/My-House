/** Avance de una meta de ahorro y el aporte mensual que necesita para llegar a tiempo. */

export type Meta = {
  objetivo: number;
  ahorrado: number;
  aporteMensual: number | null;
  /** "YYYY-MM-DD" */
  fechaObjetivo: string | null;
};

export type AvanceMeta = {
  porcentaje: number;
  falta: number;
  /** Meses desde el mes actual hasta el de la fecha objetivo (mínimo 1). */
  meses: number | null;
  /** Lo que hay que aportar cada mes para llegar a tiempo (redondeado hacia arriba a pesos). */
  aporteSugerido: number | null;
  /** "YYYY-MM" en que se llega con el aporte actual. */
  llegada: string | null;
  estado: "cumplida" | "a_tiempo" | "atrasada" | "sin_plan";
};

const mesesEntre = (desde: string, hasta: string) =>
  (Number(hasta.slice(0, 4)) - Number(desde.slice(0, 4))) * 12 + Number(hasta.slice(5, 7)) - Number(desde.slice(5, 7));

const sumarMeses = (mes: string, n: number) => {
  const t = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

export function avanceMeta(m: Meta, hoy: string): AvanceMeta {
  const falta = Math.max(0, m.objetivo - m.ahorrado);
  const porcentaje = Math.min(100, Math.floor((m.ahorrado * 100) / m.objetivo));
  if (falta === 0) return { porcentaje, falta, meses: 0, aporteSugerido: 0, llegada: hoy.slice(0, 7), estado: "cumplida" };

  const meses = m.fechaObjetivo ? Math.max(1, mesesEntre(hoy, m.fechaObjetivo)) : null;
  const aporteSugerido = meses ? Math.ceil(falta / meses) : null;
  const llegada = m.aporteMensual ? sumarMeses(hoy.slice(0, 7), Math.ceil(falta / m.aporteMensual)) : null;
  const estado = !m.aporteMensual || !aporteSugerido ? "sin_plan" : m.aporteMensual >= aporteSugerido ? "a_tiempo" : "atrasada";
  return { porcentaje, falta, meses, aporteSugerido, llegada, estado };
}
