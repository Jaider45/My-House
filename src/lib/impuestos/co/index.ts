import type { Acumulados, DependientesTributarios, JurisdiccionTributaria, ParametrosAnio, ResultadoTope, Semaforo } from "../tipos";

/** Umbral del amarillo: a partir del 70 % del tope. */
export const UMBRAL_AMARILLO = 0.7;

const TOPES: { clave: keyof Omit<Acumulados, "member_id" | "nombre">; nombre: string; ayuda: string }[] = [
  { clave: "ingresos_brutos", nombre: "Ingresos brutos", ayuda: "Todos los ingresos del año atribuidos a la persona." },
  { clave: "patrimonio_bruto", nombre: "Patrimonio bruto", ayuda: "Saldos positivos de sus cuentas al cierre. No incluye inmuebles ni vehículos." },
  { clave: "consumos_tarjeta", nombre: "Consumos con tarjeta de crédito", ayuda: "Gastos pagados con tarjetas de crédito de las que es titular." },
  { clave: "compras_consumos", nombre: "Compras y consumos", ayuda: "Total de gastos del año atribuidos a la persona." },
  { clave: "consignaciones", nombre: "Consignaciones y depósitos", ayuda: "Lo que entró a sus cuentas bancarias (ingresos y transferencias recibidas)." },
];

export function semaforo(acumulado: number, tope: number): Semaforo {
  if (tope <= 0) return "verde";
  if (acumulado >= tope) return "rojo";
  if (acumulado >= tope * UMBRAL_AMARILLO) return "amarillo";
  return "verde";
}

/**
 * Dependientes según el parágrafo 2 del art. 387 del Estatuto Tributario. Es orientación: la condición
 * (estudios, ingresos del dependiente, dictamen de dependencia) la verifica quien declara o su contador.
 */
export const dependientesColombia: DependientesTributarios = {
  orientacion({ parentesco, edad }) {
    const ingresos = "si sus ingresos del año son menores a 260 UVT o depende económicamente por una condición física o psicológica";
    switch (parentesco) {
      case "hijo":
        if (edad === null) return { podria: true, texto: "Sí, si es menor de 18 años o tiene entre 18 y 23 y tú le pagas los estudios. Agrega la fecha de nacimiento." };
        if (edad < 18) return { podria: true, texto: "Sí: hijo menor de 18 años." };
        if (edad <= 23) return { podria: true, texto: "Sí, si tú le pagas estudios en una institución formal (18 a 23 años)." };
        return { podria: true, texto: "Solo si depende económicamente por una condición física o psicológica certificada (mayor de 23 años)." };
      case "pareja":
        return { podria: true, texto: `Sí, ${ingresos}.` };
      case "padre_madre":
      case "hermano":
        return { podria: true, texto: `Sí, ${ingresos}.` };
      default:
        return { podria: false, texto: "Otros familiares no cuentan como dependientes para la DIAN." };
    }
  },
  beneficio(uvt, d, reportados) {
    if (!d.dependientes_pct || !d.dependientes_tope_anual) return null;
    const adicional = (d.dependiente_adicional ?? 0) * uvt;
    const maximo = d.dependientes_max ?? 0;
    return {
      porcentaje: d.dependientes_pct,
      topeAnual: d.dependientes_tope_anual * uvt,
      adicionalPorDependiente: adicional,
      maximoDependientes: maximo,
      adicionalTotal: adicional * Math.min(Math.max(reportados, 0), maximo),
    };
  },
};

export const colombia: JurisdiccionTributaria = {
  dependientes: dependientesColombia,
  pais: "CO",
  autoridad: "DIAN",
  unidad: "UVT",
  evaluarTopes(params: ParametrosAnio, acumulados: Acumulados): ResultadoTope[] {
    return TOPES.filter((t) => params.topes[t.clave] !== undefined).map((t) => {
      const topeUnidades = params.topes[t.clave];
      const tope = topeUnidades * params.uvt_valor;
      const acumulado = acumulados[t.clave];
      return {
        clave: t.clave,
        nombre: t.nombre,
        ayuda: t.ayuda,
        acumulado,
        tope,
        topeUnidades,
        porcentaje: tope > 0 ? Math.floor((acumulado * 100) / tope) : 0,
        semaforo: semaforo(acumulado, tope),
      };
    });
  },
};
