import { describe, expect, it } from "vitest";
import { buscarPar, buscarRegistrado, similares, type Candidato, type Pago } from ".";

const DEUDAS = "11111111-1111-4111-8111-111111111111";
const MERCADO = "22222222-2222-4222-8222-222222222222";
const DEUDA = "33333333-3333-4333-8333-333333333333";
const OTRA_DEUDA = "44444444-4444-4444-8444-444444444444";
const REGLA = "55555555-5555-4555-8555-555555555555";

const c = (x: Partial<Candidato>): Candidato => ({
  id: "c",
  fecha: "2026-11-10",
  monto: 450_000,
  tipo: "gasto",
  estado: "confirmado",
  category_id: null,
  debt_id: null,
  recurring_rule_id: null,
  comercio: null,
  ...x,
});
const p = (x: Partial<Pago>): Pago => ({ tipo: "gasto", fecha: "2026-11-10", monto: 450_000, category_id: null, comercio: null, ...x });

describe("similares", () => {
  it("compara palabras significativas sin tildes ni palabras de relleno", () => {
    expect(similares("Cuota Bancolombia", "BANCOLOMBIA PSE 0012")).toBe(true);
    expect(similares("Pago cuota", "Cuota abono")).toBe(false);
    expect(similares("Enel", "Codensa")).toBe(false);
    expect(similares(null, "Algo")).toBe(false);
  });
});

describe("buscarPar", () => {
  it("el mismo monto a ±2 días ya estaba registrado", () => {
    expect(buscarPar(p({}), [c({ fecha: "2026-11-12" })])?.motivo).toBe("mismo");
    expect(buscarPar(p({}), [c({ fecha: "2026-11-13" })])).toBeNull();
  });

  it("confirma la cuota pendiente de la deuda aunque el monto cambie un poco", () => {
    const pendiente = c({ id: "prog", estado: "programado", fecha: "2026-11-15", monto: 430_000, debt_id: DEUDA, category_id: DEUDAS });
    const par = buscarPar(p({ debt_id: DEUDA, category_id: DEUDAS, comercio: "Banco" }), [pendiente]);
    expect(par).toEqual({ candidato: pendiente, motivo: "pago_fijo" });
  });

  it("no cruza deudas distintas", () => {
    const pendiente = c({ estado: "programado", debt_id: OTRA_DEUDA });
    expect(buscarPar(p({ debt_id: DEUDA }), [pendiente])).toBeNull();
  });

  it("el pago fijo que nombró la familia gana aunque el monto sea otro", () => {
    const pendiente = c({ id: "arriendo", estado: "programado", fecha: "2026-11-25", monto: 1_800_000, recurring_rule_id: REGLA });
    expect(buscarPar(p({ monto: 1_850_000, recurring_rule_id: REGLA }), [pendiente])?.candidato.id).toBe("arriendo");
  });

  it("reconoce el pago fijo por el nombre con monto parecido", () => {
    const pendiente = c({ estado: "programado", comercio: "Internet Claro", monto: 120_000, fecha: "2026-11-05" });
    expect(buscarPar(p({ comercio: "CLARO COLOMBIA", monto: 125_900 }), [pendiente])?.motivo).toBe("pago_fijo");
    expect(buscarPar(p({ comercio: "CLARO COLOMBIA", monto: 200_000 }), [pendiente])).toBeNull();
  });

  it("por categoría solo con el mismo monto: un mercado de otro valor no confirma el pago fijo de mercado", () => {
    const pendiente = c({ estado: "programado", category_id: MERCADO, monto: 800_000 });
    expect(buscarPar(p({ category_id: MERCADO, monto: 750_000, comercio: "Éxito" }), [pendiente])).toBeNull();
    expect(buscarPar(p({ category_id: MERCADO, monto: 800_000, fecha: "2026-11-16" }), [pendiente])?.motivo).toBe("pago_fijo");
  });

  it("un gasto registrado sin deuda se liga a la deuda que se abona", () => {
    const registrado = c({ id: "r", fecha: "2026-11-07", category_id: DEUDAS });
    expect(buscarPar(p({ debt_id: DEUDA, category_id: DEUDAS }), [registrado])).toEqual({ candidato: registrado, motivo: "ligar_deuda" });
  });

  it("en el registro a mano solo mira pendientes", () => {
    expect(buscarPar(p({}), [c({})], { soloPendientes: true })).toBeNull();
    expect(buscarPar(p({}), [c({ estado: "programado" })], { soloPendientes: true })?.motivo).toBe("pago_fijo");
  });

  it("prefiere el candidato más cercano", () => {
    const lejos = c({ id: "lejos", estado: "programado", debt_id: DEUDA, fecha: "2026-11-01" });
    const cerca = c({ id: "cerca", estado: "programado", debt_id: DEUDA, fecha: "2026-11-11" });
    expect(buscarPar(p({ debt_id: DEUDA }), [lejos, cerca])?.candidato.id).toBe("cerca");
  });

  it("ignora otro tipo", () => {
    expect(buscarPar(p({ tipo: "ingreso" }), [c({})])).toBeNull();
  });
});

describe("buscarRegistrado", () => {
  const pendiente = c({ id: "prog", estado: "programado", fecha: "2026-11-15", recurring_rule_id: REGLA, comercio: "Cuota Bancolombia", debt_id: DEUDA });

  it("encuentra el comprobante ya registrado de ese pago fijo", () => {
    const comprobante = c({ id: "ocr", fecha: "2026-11-13", comercio: "Bancolombia" });
    expect(buscarRegistrado(pendiente, [comprobante])?.id).toBe("ocr");
  });

  it("no une con movimientos de otro pago fijo ni con otro monto sin relación", () => {
    expect(buscarRegistrado(pendiente, [c({ recurring_rule_id: "otra", comercio: "Bancolombia" })])).toBeNull();
    expect(buscarRegistrado(pendiente, [c({ monto: 90_000, comercio: "Panadería" })])).toBeNull();
  });
});
