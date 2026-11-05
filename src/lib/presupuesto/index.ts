/** Presupuesto del mes por categoría raíz: fijos programados + adicional, contra lo real y el pronóstico. */

export type Semaforo = "en_rango" | "atento" | "excedido";

export type EntradaCategoria = {
  id: string;
  nombre: string;
  /** Pagos fijos del mes (reglas activas, equivalente mensual). */
  fijos: number;
  /** Adicional presupuestado sobre los fijos. */
  adicional: number;
  /** Gastos confirmados del mes. */
  real: number;
  /** Gastos programados del mes que aún no se pagan. */
  programado: number;
  /** Promedio de gasto de los 3 meses cerrados anteriores. */
  promedio3: number;
};

export type FilaPresupuesto = EntradaCategoria & {
  presupuesto: number;
  diferencia: number;
  porcentaje: number;
  pronostico: number;
  semaforo: Semaforo;
};

/**
 * Pronóstico de cierre de una categoría: lo pagado + lo programado + el ritmo del gasto variable en los días
 * que faltan. Variable = real − fijos (lo que no viene de pagos fijos). Si el mes ya cerró, es lo real.
 */
export function pronosticar(c: EntradaCategoria, dia: number, diasMes: number): number {
  if (dia >= diasMes) return c.real + c.programado;
  const variable = Math.max(0, c.real - c.fijos);
  const ritmo = dia > 0 ? Math.round((variable / dia) * (diasMes - dia)) : 0;
  return c.real + c.programado + ritmo;
}

/** Excedido si lo real ya pasó el presupuesto; atento si el pronóstico lo pasa; si no, en rango. */
export function semaforo(presupuesto: number, real: number, pronostico: number): Semaforo {
  if (real > presupuesto) return "excedido";
  if (pronostico > presupuesto) return "atento";
  return "en_rango";
}

export function filasPresupuesto(categorias: EntradaCategoria[], dia: number, diasMes: number): FilaPresupuesto[] {
  return categorias
    .map((c) => {
      const presupuesto = c.fijos + c.adicional;
      const pronostico = pronosticar(c, dia, diasMes);
      return {
        ...c,
        presupuesto,
        diferencia: presupuesto - c.real,
        porcentaje: presupuesto > 0 ? Math.round((c.real * 100) / presupuesto) : c.real > 0 ? 100 : 0,
        pronostico,
        semaforo: semaforo(presupuesto, c.real, pronostico),
      };
    })
    .filter((f) => f.presupuesto > 0 || f.real > 0 || f.programado > 0)
    .sort((a, b) => b.presupuesto - a.presupuesto || b.real - a.real);
}
