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
