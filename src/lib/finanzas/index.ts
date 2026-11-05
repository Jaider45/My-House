import type { Categoria } from "@/lib/categorias";
import { sumarMeses } from "@/lib/fechas";

/** Fila de public.totales_por_categoria(): total por mes, categoría, tipo y estado. */
export type TotalCategoria = {
  mes: string; // "YYYY-MM-01"
  category_id: string | null;
  tipo: "ingreso" | "gasto" | "transferencia";
  estado: "confirmado" | "programado";
  total: number;
  /** Número de movimientos (la RPC lo trae; las pruebas pueden omitirlo). */
  cantidad?: number;
};

export type PorCategoria = { id: string | null; nombre: string; total: number };

export type ResumenMes = {
  ingresos: number;
  /** Gastos confirmados del mes (todo, incluido ahorro). */
  gastos: number;
  /** Gastos programados aún sin confirmar. */
  porPagar: number;
  /** Gastos que no son costo de vida (ahorro e inversión). */
  ahorro: number;
  /** Costo de vida = gastos confirmados + programados, sin ahorro. */
  costoVida: number;
  fijos: number;
  variables: number;
  costoPorPersona: number;
  porCategoria: PorCategoria[];
  numeroMinimo: {
    fijos: number;
    variablesEsenciales: number;
    /** Meses cerrados usados para promediar las variables esenciales (0 = se usó el mes actual). */
    mesesPromedio: number;
    imprevistos: number;
    total: number;
  };
};

const clave = (mes: string) => mes.slice(0, 7);

/**
 * Resumen del mes `mes` ("YYYY-MM"). `filas` debe traer el mes y los 3 anteriores (para el promedio de
 * variables esenciales). Montos en pesos enteros.
 */
export function resumirMes(opciones: {
  mes: string;
  filas: TotalCategoria[];
  categorias: Categoria[];
  personas: number;
  cuotaImprevistosPct: number;
}): ResumenMes {
  const { mes, filas, categorias, personas, cuotaImprevistosPct } = opciones;
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const raiz = (id: string | null) => {
    const c = id ? porId.get(id) : undefined;
    return c?.padre_id ? (porId.get(c.padre_id) ?? c) : c;
  };
  const gastosDe = (m: string) => filas.filter((f) => clave(f.mes) === m && f.tipo === "gasto");

  const delMes = filas.filter((f) => clave(f.mes) === mes);
  const ingresos = delMes.filter((f) => f.tipo === "ingreso" && f.estado === "confirmado").reduce((s, f) => s + f.total, 0);
  const gastosMes = gastosDe(mes);
  const gastos = gastosMes.filter((f) => f.estado === "confirmado").reduce((s, f) => s + f.total, 0);
  const porPagar = gastosMes.filter((f) => f.estado === "programado").reduce((s, f) => s + f.total, 0);

  let ahorro = 0;
  let fijos = 0;
  let variables = 0;
  const acumulado = new Map<string | null, PorCategoria>();
  for (const f of gastosMes) {
    const c = f.category_id ? porId.get(f.category_id) : undefined;
    if (c?.excluir_de_costo_vida) {
      ahorro += f.total;
      continue;
    }
    if (c?.tipo === "fijo") fijos += f.total;
    else variables += f.total;
    const r = raiz(f.category_id);
    const k = r?.id ?? null;
    const actual = acumulado.get(k) ?? { id: k, nombre: r?.nombre ?? "Sin categoría", total: 0 };
    actual.total += f.total;
    acumulado.set(k, actual);
  }
  const costoVida = fijos + variables;

  // Variables esenciales: promedio de los últimos 3 meses cerrados con gastos categorizados (un mes solo
  // importado y sin categorizar no dice qué fue esencial); si no hay, el mes actual.
  const esencialVariable = (f: TotalCategoria) => {
    const c = f.category_id ? porId.get(f.category_id) : undefined;
    return c !== undefined && c.tipo === "variable" && c.es_esencial && !c.excluir_de_costo_vida;
  };
  const anteriores = [1, 2, 3]
    .map((n) => gastosDe(sumarMeses(mes, -n)))
    .filter((g) => g.some((f) => f.category_id))
    .map((g) => g.filter(esencialVariable).reduce((s, f) => s + f.total, 0));
  const variablesEsenciales = anteriores.length
    ? Math.round(anteriores.reduce((s, v) => s + v, 0) / anteriores.length)
    : gastosMes.filter(esencialVariable).reduce((s, f) => s + f.total, 0);
  const imprevistos = Math.round(((fijos + variablesEsenciales) * cuotaImprevistosPct) / 100);

  return {
    ingresos,
    gastos,
    porPagar,
    ahorro,
    costoVida,
    fijos,
    variables,
    costoPorPersona: personas > 0 ? Math.round(costoVida / personas) : costoVida,
    porCategoria: [...acumulado.values()].sort((a, b) => b.total - a.total),
    numeroMinimo: {
      fijos,
      variablesEsenciales,
      mesesPromedio: anteriores.length,
      imprevistos,
      total: fijos + variablesEsenciales + imprevistos,
    },
  };
}
