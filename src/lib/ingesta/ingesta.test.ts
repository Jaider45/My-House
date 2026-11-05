import { describe, expect, it } from "vitest";
import { validarMovimiento } from ".";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CAT = "33333333-3333-4333-8333-333333333333";

describe("validarMovimiento", () => {
  it("acepta un gasto y normaliza campos vacíos", () => {
    const r = validarMovimiento({ tipo: "gasto", fecha: "04/11/2026", monto: "45000", account_id: A, category_id: CAT, comercio: "  ", member_id: "" });
    expect(r).toEqual({
      ok: true,
      movimiento: expect.objectContaining({
        fecha: "2026-11-04", monto: 45000, comercio: null, member_id: null, cuenta_destino_id: null,
        estado: "confirmado", origen: "manual",
      }),
    });
  });

  it("exige categoría en gastos e ingresos", () => {
    expect(validarMovimiento({ tipo: "ingreso", fecha: "2026-11-04", monto: 1, account_id: A })).toEqual({ ok: false, error: "Elige una categoría." });
    expect(validarMovimiento({ tipo: "gasto", fecha: "2026-11-04", monto: 1, account_id: A, origen: "importacion" }).ok).toBe(true);
  });

  it("transferencia: exige destino distinto y descarta la categoría", () => {
    expect(validarMovimiento({ tipo: "transferencia", fecha: "2026-11-04", monto: 1, account_id: A }).ok).toBe(false);
    expect(validarMovimiento({ tipo: "transferencia", fecha: "2026-11-04", monto: 1, account_id: A, cuenta_destino_id: A }).ok).toBe(false);
    const r = validarMovimiento({ tipo: "transferencia", fecha: "2026-11-04", monto: 1, account_id: A, cuenta_destino_id: B, category_id: CAT });
    expect(r.ok && r.movimiento.category_id).toBeNull();
  });

  it("rechaza montos no positivos, con decimales y fechas inválidas", () => {
    const base = { tipo: "gasto" as const, account_id: A, category_id: CAT };
    expect(validarMovimiento({ ...base, fecha: "2026-11-04", monto: 0 }).ok).toBe(false);
    expect(validarMovimiento({ ...base, fecha: "2026-11-04", monto: 10.5 }).ok).toBe(false);
    expect(validarMovimiento({ ...base, fecha: "31/02/2026", monto: 10 })).toEqual({ ok: false, error: "La fecha no es válida." });
  });
});

describe("ámbito del movimiento", () => {
  const base = { tipo: "gasto" as const, fecha: "2026-11-05", monto: 1000, account_id: "6f1c1d1e-1111-4111-8111-111111111111", category_id: "6f1c1d1e-2222-4222-8222-222222222222" };
  it("es personal por defecto y acepta negocio", () => {
    const p = validarMovimiento(base);
    expect(p.ok && p.movimiento.ambito).toBe("personal");
    const n = validarMovimiento({ ...base, ambito: "negocio" });
    expect(n.ok && n.movimiento.ambito).toBe("negocio");
    expect(validarMovimiento({ ...base, ambito: "otro" as never }).ok).toBe(false);
  });
});
