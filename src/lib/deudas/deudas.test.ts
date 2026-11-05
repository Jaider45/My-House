import { describe, expect, it } from "vitest";
import { avanceDeuda } from ".";

describe("avanceDeuda", () => {
  it("suma lo pagado antes y los abonos, y cuenta cuotas", () => {
    expect(avanceDeuda({ monto: 3_522_000, pagado_inicial: 0, abonos: 2_348_000, cuota: 587_000, cuotas_total: 6 })).toEqual({
      pagado: 2_348_000,
      pendiente: 1_174_000,
      porcentaje: 66,
      cuotasPagadas: 4,
      mesesRestantes: 2,
    });
  });

  it("abonos libres: sin cuotas ni meses, y nunca pasa del monto", () => {
    expect(avanceDeuda({ monto: 1_000, pagado_inicial: 800, abonos: 500, cuota: null, cuotas_total: null })).toMatchObject({
      pagado: 1_000,
      pendiente: 0,
      porcentaje: 100,
      cuotasPagadas: null,
      mesesRestantes: null,
    });
  });
});
