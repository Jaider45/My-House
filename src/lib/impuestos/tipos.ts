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
export type ParametrosAnio = { anio: number; uvt_valor: number; topes: Record<string, number>; deducciones?: ParametrosDeducciones };

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
  dependientes?: DependientesTributarios;
};

/** Persona a cargo tal como la ve el módulo tributario. */
export type PersonaACargo = { parentesco: "hijo" | "pareja" | "padre_madre" | "hermano" | "otro" | null; edad: number | null };

/** Topes de la deducción por dependientes del año, ya en pesos. */
export type BeneficioDependientes = {
  /** Deducción general: porcentaje de las rentas de trabajo, con tope anual. */
  porcentaje: number;
  topeAnual: number;
  /** Deducción adicional por cada dependiente y cuántos se pueden reportar como máximo. */
  adicionalPorDependiente: number;
  maximoDependientes: number;
  /** Adicional para los dependientes reportados (respetando el máximo). */
  adicionalTotal: number;
};

export type ParametrosDeducciones = {
  dependientes_pct?: number;
  dependientes_tope_anual?: number;
  dependiente_adicional?: number;
  dependientes_max?: number;
};

/** Opcional por país: orientación sobre dependientes. Si no existe, la pantalla no muestra esa sección. */
export type DependientesTributarios = {
  /** Texto corto: si la persona podría contar como dependiente y qué condición revisar. */
  orientacion(p: PersonaACargo): { podria: boolean; texto: string };
  beneficio(uvt: number, deducciones: ParametrosDeducciones, reportados: number): BeneficioDependientes | null;
};
