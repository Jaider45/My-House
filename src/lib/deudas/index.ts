/** Avance de una deuda: lo pagado sale de lo pagado antes de My House + los abonos registrados. */

export type Deuda = {
  monto: number;
  pagado_inicial: number;
  /** Suma de los movimientos confirmados con esta deuda. */
  abonos: number;
  cuota: number | null;
  cuotas_total: number | null;
};

export type AvanceDeuda = {
  pagado: number;
  pendiente: number;
  porcentaje: number;
  /** Cuotas pagadas (redondeo hacia abajo), si la deuda tiene cuota fija. */
  cuotasPagadas: number | null;
  /** Meses que faltan pagando la cuota (null = abonos libres). */
  mesesRestantes: number | null;
};

export function avanceDeuda(d: Deuda): AvanceDeuda {
  const pagado = Math.min(d.monto, d.pagado_inicial + d.abonos);
  const pendiente = d.monto - pagado;
  return {
    pagado,
    pendiente,
    porcentaje: Math.floor((pagado * 100) / d.monto),
    cuotasPagadas: d.cuota ? Math.min(d.cuotas_total ?? Infinity, Math.floor(pagado / d.cuota)) : null,
    mesesRestantes: d.cuota ? Math.ceil(pendiente / d.cuota) : null,
  };
}

/** Próxima fecha (≥ hoy) con el día del mes indicado; si el mes no lo tiene, el último día. "YYYY-MM-DD". */
export function proximoDia(dia: number, hoy: string): string {
  const a = Number(hoy.slice(0, 4));
  const m = Number(hoy.slice(5, 7));
  const fecha = (anio: number, mes: number) => {
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
  };
  const este = fecha(a, m);
  return este >= hoy ? este : m === 12 ? fecha(a + 1, 1) : fecha(a, m + 1);
}

export type PlanCuota = { primera: string; cuotas: number; ultima: string };

/**
 * Pago fijo de la cuota de una deuda (diseño «Nueva deuda»): cuántas cuotas faltan —las acordadas menos las que
 * cubre lo ya pagado, o lo pendiente entre la cuota— y en qué fecha cae la última.
 */
export function planCuota(d: { monto: number; pagado_inicial: number; cuota: number; cuotas_total: number | null; dia_pago: number; hoy: string }): PlanCuota | null {
  if (d.cuota <= 0 || d.monto <= d.pagado_inicial) return null;
  const pendientes = Math.ceil((d.monto - d.pagado_inicial) / d.cuota);
  const cuotas = d.cuotas_total ? Math.max(1, Math.min(pendientes, d.cuotas_total - Math.floor(d.pagado_inicial / d.cuota))) : pendientes;
  const primera = proximoDia(d.dia_pago, d.hoy);
  const t = Number(primera.slice(0, 4)) * 12 + Number(primera.slice(5, 7)) - 1 + (cuotas - 1);
  const ultima = proximoDia(d.dia_pago, `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`);
  return { primera, cuotas, ultima };
}

/** ¿La categoría es Deudas o una subcategoría suya? Ahí el registro pregunta qué deuda se paga. */
export function esCategoriaDeudas(categorias: { id: string; nombre: string; padre_id: string | null }[], id: string | null | undefined): boolean {
  if (!id) return false;
  const porId = new Map(categorias.map((c) => [c.id, c]));
  let c = porId.get(id);
  for (let i = 0; c && i < 5; i++) {
    if (!c.padre_id) return c.nombre === "Deudas";
    c = porId.get(c.padre_id);
  }
  return false;
}
