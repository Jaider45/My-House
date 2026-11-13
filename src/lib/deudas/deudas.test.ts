import { describe, expect, it } from "vitest";
import { avanceDeuda, planCuota, proximoDia } from ".";

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

describe("pago fijo de la cuota", () => {
  it("próximo día del mes, con el último día si el mes es corto", () => {
    expect(proximoDia(10, "2026-11-14")).toBe("2026-12-10");
    expect(proximoDia(20, "2026-11-14")).toBe("2026-11-20");
    expect(proximoDia(31, "2027-02-01")).toBe("2027-02-28");
    expect(proximoDia(5, "2026-12-20")).toBe("2027-01-05");
  });

  it("24 cuotas desde diciembre terminan en noviembre de 2028", () => {
    expect(planCuota({ monto: 12_000_000, pagado_inicial: 0, cuota: 612_000, cuotas_total: 24, dia_pago: 10, hoy: "2026-11-14" })).toEqual({ primera: "2026-12-10", cuotas: 20, ultima: "2028-07-10" });
    expect(planCuota({ monto: 14_688_000, pagado_inicial: 0, cuota: 612_000, cuotas_total: 24, dia_pago: 10, hoy: "2026-11-14" })).toEqual({ primera: "2026-12-10", cuotas: 24, ultima: "2028-11-10" });
  });

  it("lo ya pagado descuenta cuotas; sin número de cuotas sale de lo pendiente", () => {
    expect(planCuota({ monto: 1_200_000, pagado_inicial: 300_000, cuota: 100_000, cuotas_total: 12, dia_pago: 1, hoy: "2026-11-14" })?.cuotas).toBe(9);
    expect(planCuota({ monto: 1_000_000, pagado_inicial: 0, cuota: 300_000, cuotas_total: null, dia_pago: 1, hoy: "2026-11-14" })?.cuotas).toBe(4);
    expect(planCuota({ monto: 100, pagado_inicial: 100, cuota: 10, cuotas_total: null, dia_pago: 1, hoy: "2026-11-14" })).toBeNull();
  });
});
