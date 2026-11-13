/** Presupuesto del mes por categoría raíz: fijos programados + adicional, contra lo real y el pronóstico. */

import type { PlanMes } from "@/lib/finanzas";
import { fechasEnRango, montoMensual, type Frecuencia } from "@/lib/recurrentes";

/** Pago fijo (regla recurrente activa) tal como lo necesita el plan del mes. */
export type ReglaPlan = {
  monto: number;
  tipo: "gasto" | "ingreso" | "transferencia";
  category_id: string | null;
  frecuencia: Frecuencia;
  fecha_inicio: string;
  /** Ocurrencias ya generadas como movimientos. */
  ocurrencias: number;
};

/**
 * Plan del mes `mes` ("YYYY-MM") con las reglas activas y el gasto variable presupuestado por categoría.
 * `porProgramar` = ocurrencias de pagos fijos entre hoy (o el inicio del mes) y fin de mes que aún no son
 * movimientos (las reglas se programan solo 7 días antes).
 */
export function armarPlan(opciones: {
  mes: string;
  hoy: string;
  hasta: string;
  reglas: ReglaPlan[];
  presupuestos: { category_id: string | null; monto: number }[];
}): PlanMes {
  const { mes, hoy, hasta, reglas, presupuestos } = opciones;
  const desde = `${mes}-01` > hoy ? `${mes}-01` : hoy;
  const categorias: PlanMes["categorias"] = [];
  let ingresosFijos = 0;
  const porProgramar = { monto: 0, cantidad: 0 };
  for (const r of reglas) {
    if (r.tipo === "ingreso") {
      ingresosFijos += montoMensual(r.monto, r.frecuencia);
      continue;
    }
    if (r.tipo !== "gasto") continue;
    if (r.category_id) categorias.push({ category_id: r.category_id, fijos: montoMensual(r.monto, r.frecuencia), variable: 0 });
    const fechas = desde <= hasta ? fechasEnRango(r.fecha_inicio, r.frecuencia, r.ocurrencias, desde, hasta) : [];
    porProgramar.monto += fechas.length * r.monto;
    porProgramar.cantidad += fechas.length;
  }
  for (const p of presupuestos) if (p.category_id && p.monto > 0) categorias.push({ category_id: p.category_id, fijos: 0, variable: p.monto });
  return { categorias, ingresosFijos, porProgramar };
}

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
 * Pronóstico de cierre de una categoría: lo pagado + lo programado (nunca menos que los pagos fijos del mes,
 * porque los fijos se programan solo 7 días antes) + el ritmo del gasto variable en los días que faltan.
 * Variable = real − fijos (lo que no viene de pagos fijos). Si el mes ya cerró, es lo real.
 */
export function pronosticar(c: EntradaCategoria, dia: number, diasMes: number): number {
  if (dia >= diasMes) return c.real + c.programado;
  const variable = Math.max(0, c.real - c.fijos);
  const ritmo = dia > 0 ? Math.round((variable / dia) * (diasMes - dia)) : 0;
  return Math.max(c.real + c.programado, c.fijos + variable) + ritmo;
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

/**
 * Entradas de `filasPresupuesto` por categoría raíz de gasto (sin las de ahorro): pagos fijos (equivalente mensual),
 * gasto variable presupuestado, lo real y programado de `mes` y el promedio de los 3 meses anteriores. Es el mismo
 * cálculo de la pantalla Presupuesto; Inicio lo usa para el top de categorías y el gasto pronosticado.
 */
export function entradasPorCategoria(opciones: {
  mes: string;
  categorias: { id: string; nombre: string; padre_id: string | null; clase: string; archivada: boolean; excluir_de_costo_vida: boolean }[];
  reglas: { tipo: string; category_id: string | null; monto: number; frecuencia: Frecuencia }[];
  presupuestos: { category_id: string; monto: number }[];
  totales: { mes: string; category_id: string | null; tipo: string; estado: string; total: number }[];
}): EntradaCategoria[] {
  const { mes, categorias, reglas, presupuestos, totales } = opciones;
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const raiz = (id: string | null) => {
    const c = id ? porId.get(id) : undefined;
    return c ? (c.padre_id && porId.has(c.padre_id) ? c.padre_id : c.id) : null;
  };
  const [a, m] = mes.split("-").map(Number);
  const hace3 = `${new Date(Date.UTC(a, m - 4, 1)).toISOString().slice(0, 7)}`;
  const suma = new Map<string, { fijos: number; adicional: number; real: number; programado: number; previos: number }>();
  const de = (id: string) => suma.get(id) ?? (suma.set(id, { fijos: 0, adicional: 0, real: 0, programado: 0, previos: 0 }), suma.get(id)!);
  for (const r of reglas) {
    const id = r.tipo === "gasto" ? raiz(r.category_id) : null;
    if (id) de(id).fijos += montoMensual(r.monto, r.frecuencia);
  }
  for (const p of presupuestos) de(p.category_id).adicional += p.monto;
  for (const f of totales) {
    const id = raiz(f.category_id);
    if (!id || f.tipo !== "gasto") continue;
    const mf = f.mes.slice(0, 7);
    if (mf === mes) de(id)[f.estado === "confirmado" ? "real" : "programado"] += f.total;
    else if (mf >= hace3 && mf < mes) de(id).previos += f.total;
  }
  return categorias
    .filter((c) => c.clase === "gasto" && !c.padre_id && !c.archivada && !c.excluir_de_costo_vida)
    .map((c) => {
      const s = de(c.id);
      return { id: c.id, nombre: c.nombre, fijos: s.fijos, adicional: s.adicional, real: s.real, programado: s.programado, promedio3: Math.round(s.previos / 3) };
    });
}
