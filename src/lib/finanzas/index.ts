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

/**
 * Plan del mes: lo que el hogar ya sabe que va a gastar. Se usa en el mes actual (los meses cerrados se miden con
 * lo real). `categorias` trae, por categoría (raíz o subcategoría), el equivalente mensual de los pagos fijos activos
 * y el gasto variable presupuestado.
 */
export type PlanMes = {
  categorias: { category_id: string; fijos: number; variable: number }[];
  /** Equivalente mensual de los ingresos fijos activos (salario, arriendos…). */
  ingresosFijos: number;
  /** Pagos fijos del resto del mes que todavía no se han programado como movimientos. */
  porProgramar: { monto: number; cantidad: number };
};

/** Detalle por categoría raíz del costo de vida esperado del mes. */
export type EsperadoCategoria = {
  id: string | null;
  nombre: string;
  esencial: boolean;
  /** Pagos fijos + gasto variable presupuestado. */
  presupuesto: number;
  /** Gastos confirmados + programados del mes. */
  comprometido: number;
  /** max(presupuesto, comprometido): lo que costará la categoría este mes. */
  esperado: number;
  /** Parte fija de lo esperado (pagos fijos, o lo gastado en categorías de tipo fijo). */
  fijos: number;
};

export type ResumenMes = {
  /** Ingresos confirmados del mes. */
  ingresos: number;
  /** Ingresos con los que se cuenta: confirmados + programados, o los ingresos fijos si son más. */
  ingresosEsperados: number;
  /** Gastos confirmados del mes (todo, incluido ahorro). */
  gastos: number;
  /** Pagos pendientes del mes: programados sin confirmar + pagos fijos que aún no se programan. */
  porPagar: number;
  pagosPorPagar: number;
  /** Gastos que no son costo de vida (ahorro e inversión). */
  ahorro: number;
  /**
   * Costo de vida = Σ por categoría max(presupuesto, gastos confirmados + programados), sin ahorro. Sin plan
   * (meses cerrados) es lo gastado.
   */
  costoVida: number;
  /** Parte del costo de vida en categorías esenciales. */
  costoEsencial: number;
  fijos: number;
  variables: number;
  costoPorPersona: number;
  /** Ingresos esperados − costo de vida. */
  ahorroProyectado: number;
  /** Gastado por categoría raíz (confirmado + programado), de mayor a menor. */
  porCategoria: PorCategoria[];
  /** Costo de vida esperado por categoría raíz, de mayor a menor. */
  esperadoPorCategoria: EsperadoCategoria[];
  numeroMinimo: {
    /** Pagos fijos de las categorías esenciales. */
    fijos: number;
    /** Resto de lo necesario en categorías esenciales: max(presupuesto, promedio, fijos) − fijos. */
    variablesEsenciales: number;
    /** Meses cerrados usados para promediar (0 = se usó el mes actual). */
    mesesPromedio: number;
    imprevistos: number;
    total: number;
  };
};

const clave = (mes: string) => mes.slice(0, 7);
const sumar = (filas: { total: number }[]) => filas.reduce((s, f) => s + f.total, 0);

/**
 * Resumen del mes `mes` ("YYYY-MM"). `filas` debe traer el mes y los 3 anteriores (para los promedios). `plan`
 * (pagos fijos y presupuesto) solo se pasa para el mes en curso. Montos en pesos enteros.
 *
 * Por cada categoría raíz (sin las excluidas del costo de vida):
 * - esperado = max(presupuesto, comprometido); costo de vida = Σ esperado.
 * - fijos = max(pagos fijos del plan, comprometido si la categoría es de tipo fijo); variables = esperado − fijos.
 * - número mínimo (solo esenciales): max(presupuesto, promedio de 3 meses cerrados, fijos) + cuota de imprevistos.
 */
export function resumirMes(opciones: {
  mes: string;
  filas: TotalCategoria[];
  categorias: Categoria[];
  personas: number;
  cuotaImprevistosPct: number;
  plan?: PlanMes;
}): ResumenMes {
  const { mes, filas, categorias, personas, cuotaImprevistosPct, plan } = opciones;
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const raiz = (id: string | null) => {
    const c = id ? porId.get(id) : undefined;
    return c?.padre_id ? (porId.get(c.padre_id) ?? c) : c;
  };
  const gastosDe = (m: string) => filas.filter((f) => clave(f.mes) === m && f.tipo === "gasto");

  const delMes = filas.filter((f) => clave(f.mes) === mes);
  const ingresosDelMes = delMes.filter((f) => f.tipo === "ingreso");
  const ingresos = sumar(ingresosDelMes.filter((f) => f.estado === "confirmado"));
  const ingresosEsperados = Math.max(sumar(ingresosDelMes), plan?.ingresosFijos ?? 0);
  const gastosMes = gastosDe(mes);
  const gastos = sumar(gastosMes.filter((f) => f.estado === "confirmado"));
  const programados = gastosMes.filter((f) => f.estado === "programado");
  const porPagar = sumar(programados) + (plan?.porProgramar.monto ?? 0);
  const pagosPorPagar = programados.reduce((s, f) => s + (f.cantidad ?? 1), 0) + (plan?.porProgramar.cantidad ?? 0);

  type Acumulado = EsperadoCategoria & { categoria?: Categoria; fijosPlan: number; previos: number[] };
  const grupos = new Map<string | null, Acumulado>();
  const grupo = (id: string | null) => {
    const r = raiz(id);
    const k = r?.id ?? null;
    let g = grupos.get(k);
    if (!g) {
      g = { id: k, nombre: r?.nombre ?? "Sin categoría", esencial: !!r?.es_esencial, categoria: r, presupuesto: 0, comprometido: 0, esperado: 0, fijos: 0, fijosPlan: 0, previos: [0, 0, 0] };
      grupos.set(k, g);
    }
    return g;
  };
  const excluida = (id: string | null) => !!(id && (porId.get(id)?.excluir_de_costo_vida || raiz(id)?.excluir_de_costo_vida));

  let ahorro = 0;
  for (const f of gastosMes) {
    if (excluida(f.category_id)) ahorro += f.total;
    else grupo(f.category_id).comprometido += f.total;
  }
  for (const p of plan?.categorias ?? []) {
    if (!porId.has(p.category_id) || excluida(p.category_id)) continue;
    const g = grupo(p.category_id);
    g.fijosPlan += p.fijos;
    g.presupuesto += p.fijos + p.variable;
  }

  // Meses cerrados con gastos categorizados (un mes solo importado y sin categorizar no dice qué fue esencial).
  const anteriores = [1, 2, 3].map((n) => gastosDe(sumarMeses(mes, -n))).filter((g) => g.some((f) => f.category_id));
  anteriores.forEach((gastosMesPrevio, i) => {
    for (const f of gastosMesPrevio) {
      if (!f.category_id || excluida(f.category_id)) continue;
      const r = raiz(f.category_id);
      if (r?.es_esencial) grupo(f.category_id).previos[i] += f.total;
    }
  });

  let costoVida = 0;
  let costoEsencial = 0;
  let fijos = 0;
  let minimoFijos = 0;
  let minimoNecesario = 0;
  for (const g of grupos.values()) {
    g.esperado = Math.max(g.presupuesto, g.comprometido);
    g.fijos = Math.max(g.fijosPlan, g.categoria?.tipo === "fijo" ? g.comprometido : 0);
    costoVida += g.esperado;
    fijos += g.fijos;
    if (!g.esencial) continue;
    costoEsencial += g.esperado;
    const promedio = anteriores.length
      ? Math.round(g.previos.slice(0, anteriores.length).reduce((s, v) => s + v, 0) / anteriores.length)
      : g.comprometido;
    minimoFijos += g.fijos;
    minimoNecesario += Math.max(g.presupuesto, promedio, g.fijos);
  }
  const variablesEsenciales = minimoNecesario - minimoFijos;
  const imprevistos = Math.round((minimoNecesario * cuotaImprevistosPct) / 100);

  const lista = [...grupos.values()];
  const limpiar = (g: Acumulado): EsperadoCategoria => ({
    id: g.id, nombre: g.nombre, esencial: g.esencial, presupuesto: g.presupuesto, comprometido: g.comprometido, esperado: g.esperado, fijos: g.fijos,
  });
  return {
    ingresos,
    ingresosEsperados,
    gastos,
    porPagar,
    pagosPorPagar,
    ahorro,
    costoVida,
    costoEsencial,
    fijos,
    variables: costoVida - fijos,
    costoPorPersona: personas > 0 ? Math.round(costoVida / personas) : costoVida,
    ahorroProyectado: ingresosEsperados - costoVida,
    porCategoria: lista
      .filter((g) => g.comprometido > 0)
      .map((g) => ({ id: g.id, nombre: g.nombre, total: g.comprometido }))
      .sort((a, b) => b.total - a.total),
    esperadoPorCategoria: lista
      .filter((g) => g.esperado > 0)
      .map(limpiar)
      .sort((a, b) => b.esperado - a.esperado),
    numeroMinimo: {
      fijos: minimoFijos,
      variablesEsenciales,
      mesesPromedio: anteriores.length,
      imprevistos,
      total: minimoNecesario + imprevistos,
    },
  };
}
