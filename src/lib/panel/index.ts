/**
 * Inicio modular: qué indicadores y qué secciones ve cada persona en su Inicio. Puro y liviano (lo usa el editor en el
 * navegador). Se guarda por persona en `user_metadata.panel`, como el avance de la Academia: cada quien arma el suyo.
 */

export type IdIndicador =
  | "ingresos"
  | "gastos"
  | "pendientes"
  | "ahorro"
  | "numero_minimo"
  | "pronosticado"
  | "costo_vida"
  | "costo_persona"
  | "tasa_ahorro"
  | "disponible"
  | "meses_cubiertos"
  | "deuda_pendiente"
  | "cuotas_mes"
  | "carga_deuda"
  | "deuda_libre"
  | "metas_ahorrado"
  | "tarjetas_usado"
  | "esenciales";

export type IdSeccion = "accesos" | "aviso_dian" | "grafico" | "proximos_pagos" | "top_categorias" | "deudas" | "metas" | "academia";

export type Panel = { plantilla: IdPlantilla | "propio"; indicadores: IdIndicador[]; secciones: IdSeccion[] };

export const INDICADORES: Record<IdIndicador, { nombre: string; descripcion: string; grupo: "Mes" | "Ahorro" | "Deudas" | "Cuentas" }> = {
  ingresos: { nombre: "Ingresos del mes", descripcion: "Lo que entró y lo que falta por entrar", grupo: "Mes" },
  gastos: { nombre: "Gastos del mes", descripcion: "Lo pagado contra el gasto pronosticado", grupo: "Mes" },
  pendientes: { nombre: "Pagos fijos pendientes", descripcion: "Lo que falta pagar este mes y lo vencido", grupo: "Mes" },
  pronosticado: { nombre: "Gasto pronosticado", descripcion: "Cómo cerraría el mes a este ritmo", grupo: "Mes" },
  costo_vida: { nombre: "Costo de vida", descripcion: "Cuánto cuesta sostener la casa, fijo y variable", grupo: "Mes" },
  costo_persona: { nombre: "Costo por persona", descripcion: "Costo de vida dividido entre todos", grupo: "Mes" },
  esenciales: { nombre: "Gasto esencial", descripcion: "Qué parte del costo de vida es indispensable", grupo: "Mes" },
  numero_minimo: { nombre: "Número mínimo del hogar", descripcion: "Lo que la casa necesita sí o sí cada mes", grupo: "Ahorro" },
  ahorro: { nombre: "Ahorro del mes", descripcion: "Ingresos esperados menos costo de vida", grupo: "Ahorro" },
  tasa_ahorro: { nombre: "Tasa de ahorro", descripcion: "Qué porcentaje de los ingresos queda", grupo: "Ahorro" },
  metas_ahorrado: { nombre: "Ahorrado en metas", descripcion: "Avance de todas las metas juntas", grupo: "Ahorro" },
  meses_cubiertos: { nombre: "Meses cubiertos", descripcion: "Cuántos meses aguanta la plata disponible el número mínimo", grupo: "Ahorro" },
  deuda_pendiente: { nombre: "Deuda pendiente", descripcion: "Lo que falta pagar de todas las deudas", grupo: "Deudas" },
  cuotas_mes: { nombre: "Cuotas del mes", descripcion: "Lo que se va en deudas este mes", grupo: "Deudas" },
  carga_deuda: { nombre: "Carga de deuda", descripcion: "Cuotas del mes frente a los ingresos", grupo: "Deudas" },
  deuda_libre: { nombre: "Libres de deudas", descripcion: "Cuándo terminan las cuotas fijas", grupo: "Deudas" },
  disponible: { nombre: "Plata disponible", descripcion: "Saldo de bancos, efectivo y billeteras", grupo: "Cuentas" },
  tarjetas_usado: { nombre: "Tarjetas usadas", descripcion: "Deuda de las tarjetas frente al cupo", grupo: "Cuentas" },
};

export const SECCIONES: Record<IdSeccion, { nombre: string; descripcion: string }> = {
  accesos: { nombre: "Accesos rápidos", descripcion: "Registrar, subir un comprobante, importar" },
  aviso_dian: { nombre: "Aviso de Renta DIAN", descripcion: "Quién está cerca de tener que declarar" },
  grafico: { nombre: "Ingresos contra gastos", descripcion: "Gráfico de los últimos 12 meses" },
  proximos_pagos: { nombre: "Próximos pagos", descripcion: "Lo que vence en los próximos 15 días" },
  top_categorias: { nombre: "Top de categorías", descripcion: "Dónde más se gasta, contra el presupuesto" },
  deudas: { nombre: "Deudas", descripcion: "Avance de cada deuda y cuándo termina" },
  metas: { nombre: "Metas de ahorro", descripcion: "Avance de cada meta" },
  academia: { nombre: "Academia", descripcion: "Lecciones recomendadas" },
};

export type IdPlantilla = "general" | "ahorro" | "deudas" | "control" | "tranquilidad";

export const PLANTILLAS: Record<IdPlantilla, { nombre: string; descripcion: string; icono: string; indicadores: IdIndicador[]; secciones: IdSeccion[] }> = {
  general: {
    nombre: "Resumen general",
    descripcion: "Un poco de todo: el mes, los pagos y el número mínimo",
    icono: "resumen",
    indicadores: ["ingresos", "gastos", "pendientes", "ahorro", "numero_minimo", "pronosticado"],
    secciones: ["accesos", "aviso_dian", "grafico", "proximos_pagos", "top_categorias", "academia"],
  },
  ahorro: {
    nombre: "Ahorro y rendimiento",
    descripcion: "Cuánto queda cada mes y cómo van las metas",
    icono: "ahorro",
    indicadores: ["ingresos", "ahorro", "tasa_ahorro", "metas_ahorrado", "disponible", "costo_vida"],
    secciones: ["grafico", "metas", "top_categorias", "accesos"],
  },
  deudas: {
    nombre: "Deudas",
    descripcion: "Cuánto deben, cuánto pesa cada mes y cuándo terminan",
    icono: "deducciones",
    indicadores: ["deuda_pendiente", "cuotas_mes", "carga_deuda", "deuda_libre", "tarjetas_usado", "pendientes"],
    secciones: ["deudas", "proximos_pagos", "grafico", "accesos"],
  },
  control: {
    nombre: "Control del gasto",
    descripcion: "Presupuesto, categorías y cómo va a cerrar el mes",
    icono: "egresos",
    indicadores: ["gastos", "pronosticado", "costo_vida", "esenciales", "costo_persona", "pendientes"],
    secciones: ["top_categorias", "proximos_pagos", "accesos", "grafico"],
  },
  tranquilidad: {
    nombre: "Colchón y tranquilidad",
    descripcion: "Si la casa aguanta un imprevisto y lo que viene",
    icono: "casa",
    indicadores: ["numero_minimo", "disponible", "meses_cubiertos", "ahorro", "deuda_pendiente", "metas_ahorrado"],
    secciones: ["aviso_dian", "metas", "deudas", "proximos_pagos"],
  },
};

export const MAX_INDICADORES = 9;

export const panelDePlantilla = (id: IdPlantilla): Panel => ({ plantilla: id, indicadores: [...PLANTILLAS[id].indicadores], secciones: [...PLANTILLAS[id].secciones] });

const esPlantilla = (v: unknown): v is IdPlantilla => typeof v === "string" && v in PLANTILLAS;
const lista = <T extends string>(v: unknown, validos: Record<T, unknown>, max: number): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => typeof x === "string" && x in validos))].slice(0, max) : [];

/** El panel de la persona (`user_metadata.panel`): solo ids que existen; sin nada guardado, el Resumen general. */
export function leerPanel(metadata: Record<string, unknown> | null | undefined): Panel {
  const p = metadata?.panel as Record<string, unknown> | undefined;
  if (!p || typeof p !== "object") return panelDePlantilla("general");
  const plantilla = esPlantilla(p.plantilla) ? p.plantilla : "propio";
  const indicadores = lista(p.indicadores, INDICADORES, MAX_INDICADORES);
  const secciones = lista(p.secciones, SECCIONES, Object.keys(SECCIONES).length);
  if (!indicadores.length && !secciones.length) return panelDePlantilla(esPlantilla(p.plantilla) ? p.plantilla : "general");
  return { plantilla, indicadores, secciones };
}

/** Valida lo que manda el editor. La plantilla queda solo si el panel es idéntico a ella (si no, «propio»). */
export function normalizarPanel(entrada: { plantilla?: unknown; indicadores?: unknown; secciones?: unknown }): Panel | null {
  const indicadores = lista(entrada.indicadores, INDICADORES, MAX_INDICADORES);
  const secciones = lista(entrada.secciones, SECCIONES, Object.keys(SECCIONES).length);
  if (!indicadores.length && !secciones.length) return null;
  const base = esPlantilla(entrada.plantilla) ? PLANTILLAS[entrada.plantilla] : null;
  const igual = base && base.indicadores.join() === indicadores.join() && base.secciones.join() === secciones.join();
  return { plantilla: igual ? (entrada.plantilla as IdPlantilla) : "propio", indicadores, secciones };
}

/** Qué datos extra hay que pedir a la base para este panel (el resto sale del resumen del mes). */
export function datosNecesarios(p: Panel) {
  const i = new Set<string>(p.indicadores);
  const s = new Set<string>(p.secciones);
  return {
    deudas: ["deuda_pendiente", "cuotas_mes", "carga_deuda", "deuda_libre"].some((x) => i.has(x)) || s.has("deudas"),
    metas: i.has("metas_ahorrado") || s.has("metas"),
    saldos: ["disponible", "meses_cubiertos", "tarjetas_usado"].some((x) => i.has(x)),
    semaforo: s.has("aviso_dian"),
  };
}
