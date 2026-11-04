import type { Acumulados, JurisdiccionTributaria, ParametrosAnio, ResultadoTope, Semaforo } from "../tipos";

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

export const colombia: JurisdiccionTributaria = {
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
