import { describe, expect, it } from "vitest";
import { conPreferencias, estaEnPaso, evaluarRecorrido, leerPreferencias, PASOS, type DatosRecorrido } from ".";

const vacio: DatosRecorrido = { cuentas: 0, ingresosFijos: 0, pagosFijos: 0, presupuestos: 0, movimientos: 0, personas: 1, invitaciones: 0, dosPasos: false };
const sinPref = { oculto: false, omitidos: [] };

describe("evaluarRecorrido", () => {
  it("hogar nuevo: nada hecho y el siguiente paso es crear cuentas", () => {
    const r = evaluarRecorrido(vacio, sinPref);
    expect(r.hechos).toBe(0);
    expect(r.total).toBe(PASOS.length);
    expect(r.siguiente?.clave).toBe("cuentas");
    expect(r.completo).toBe(false);
    expect(r.porcentaje).toBe(0);
  });

  it("marca cada paso con los datos del hogar", () => {
    const r = evaluarRecorrido({ ...vacio, cuentas: 2, pagosFijos: 3 }, sinPref);
    const hechos = r.pasos.filter((p) => p.hecho).map((p) => p.clave);
    expect(hechos).toEqual(["cuentas", "pagos_fijos"]);
    expect(r.siguiente?.clave).toBe("ingresos");
  });

  it("una sola persona no cuenta como invitar; una invitación o un segundo miembro sí", () => {
    expect(evaluarRecorrido(vacio, sinPref).pasos.find((p) => p.clave === "personas")?.hecho).toBe(false);
    expect(evaluarRecorrido({ ...vacio, invitaciones: 1 }, sinPref).pasos.find((p) => p.clave === "personas")?.hecho).toBe(true);
    expect(evaluarRecorrido({ ...vacio, personas: 3 }, sinPref).pasos.find((p) => p.clave === "personas")?.hecho).toBe(true);
  });

  it("los omitidos cuentan como resueltos y se saltan; lo hecho no figura como omitido", () => {
    const r = evaluarRecorrido({ ...vacio, cuentas: 1 }, { oculto: false, omitidos: ["cuentas", "ingresos"] });
    expect(r.pasos[0]).toMatchObject({ hecho: true, omitido: false });
    expect(r.pasos[1]).toMatchObject({ hecho: false, omitido: true });
    expect(r.resueltos).toBe(2);
    expect(r.hechos).toBe(1);
    expect(r.siguiente?.clave).toBe("pagos_fijos");
  });

  it("completo cuando todo está hecho u omitido", () => {
    const todo: DatosRecorrido = { cuentas: 1, ingresosFijos: 1, pagosFijos: 1, presupuestos: 1, movimientos: 1, personas: 2, invitaciones: 0, dosPasos: false };
    const r = evaluarRecorrido(todo, { oculto: false, omitidos: ["seguridad"] });
    expect(r.completo).toBe(true);
    expect(r.siguiente).toBeNull();
    expect(r.porcentaje).toBe(100);
  });
});

describe("preferencias en user_metadata", () => {
  const hogar = "h1";

  it("sin datos o mal formadas: valores por defecto", () => {
    expect(leerPreferencias(undefined, hogar)).toEqual(sinPref);
    expect(leerPreferencias({ recorrido: "x" }, hogar)).toEqual(sinPref);
    expect(leerPreferencias({ recorrido: { h1: { oculto: "sí", omitidos: ["cuentas", "inventado", 3] } } }, hogar)).toEqual({
      oculto: false,
      omitidos: ["cuentas"],
    });
  });

  it("guarda por hogar sin tocar los demás y sin repetidos", () => {
    const meta = { nombre: "Ana", recorrido: { h2: { oculto: true, omitidos: [] } } };
    const nuevo = conPreferencias(meta, hogar, { oculto: false, omitidos: ["seguridad", "seguridad"] });
    expect(nuevo).toEqual({ h2: { oculto: true, omitidos: [] }, h1: { oculto: false, omitidos: ["seguridad"] } });
    expect(leerPreferencias({ recorrido: nuevo }, hogar)).toEqual({ oculto: false, omitidos: ["seguridad"] });
  });
});

describe("estaEnPaso", () => {
  const pagos = PASOS.find((p) => p.clave === "pagos_fijos")!;
  it("reconoce la ruta y sus subrutas, no prefijos sueltos", () => {
    expect(estaEnPaso("/presupuesto", pagos)).toBe(true);
    expect(estaEnPaso("/recurrentes/editar", pagos)).toBe(true);
    expect(estaEnPaso("/presupuestos", pagos)).toBe(false);
    expect(estaEnPaso(null, pagos)).toBe(false);
  });
});
