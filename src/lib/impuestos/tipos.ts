/** Contrato de un módulo tributario por país. Agregar un país = implementar esto y registrarlo. */

/** Lo acumulado por una persona en el año (sale de public.acumulados_tributarios). */
export type Acumulados = {
  member_id: string;
  nombre: string;
  ingresos_brutos: number;
  consumos_tarjeta: number;
  compras_consumos: number;
  consignaciones: number;
  patrimonio_bruto: number;
};

/** Fila de public.tax_params: valor de la unidad tributaria y topes expresados en esa unidad. */
export type ParametrosAnio = { anio: number; uvt_valor: number; topes: Record<string, number> };

export type Semaforo = "verde" | "amarillo" | "rojo";

export type ResultadoTope = {
  clave: string;
  nombre: string;
  ayuda: string;
  acumulado: number;
  /** Tope en pesos = unidades × valor de la unidad del año. */
  tope: number;
  topeUnidades: number;
  /** Porcentaje alcanzado, truncado (99,6 % se muestra 99 %: no adelanta el rojo). */
  porcentaje: number;
  semaforo: Semaforo;
};

export type JurisdiccionTributaria = {
  pais: string;
  autoridad: string;
  unidad: string;
  /** Evalúa los topes para declarar de una persona. */
  evaluarTopes(params: ParametrosAnio, acumulados: Acumulados): ResultadoTope[];
};
