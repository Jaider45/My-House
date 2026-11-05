import { describe, expect, it } from "vitest";
import { fechaOcurrencia, fechasEnRango, montoMensual, primeraDesde } from ".";

describe("fechaOcurrencia", () => {
  it("mensual desde el 31 no se corre: usa el último día y vuelve al 31", () => {
    expect([0, 1, 2, 3, 4].map((n) => fechaOcurrencia("2026-01-31", "mensual", n))).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31",
    ]);
  });

  it("respeta años bisiestos y cruza de año", () => {
    expect(fechaOcurrencia("2027-12-31", "bimestral", 1)).toBe("2028-02-29");
    expect(fechaOcurrencia("2026-11-15", "trimestral", 1)).toBe("2027-02-15");
    expect(fechaOcurrencia("2028-02-29", "anual", 1)).toBe("2029-02-28");
  });

  it("semanal y quincenal suman días", () => {
    expect(fechaOcurrencia("2026-12-28", "semanal", 1)).toBe("2027-01-04");
    expect(fechaOcurrencia("2026-01-15", "quincenal", 2)).toBe("2026-02-14");
  });
});

describe("primeraDesde", () => {
  it("devuelve la primera ocurrencia en o después de la fecha", () => {
    expect(primeraDesde("2026-01-31", "mensual", "2026-11-04")).toEqual({ ocurrencias: 10, fecha: "2026-11-30" });
    expect(primeraDesde("2026-11-04", "mensual", "2026-11-04")).toEqual({ ocurrencias: 0, fecha: "2026-11-04" });
    expect(primeraDesde("2026-12-01", "anual", "2026-11-04")).toEqual({ ocurrencias: 0, fecha: "2026-12-01" });
  });
});

describe("montoMensual", () => {
  it("convierte a equivalente mensual redondeado", () => {
    expect(montoMensual(1_200_000, "anual")).toBe(100_000);
    expect(montoMensual(100_000, "semanal")).toBe(433_333);
    expect(montoMensual(300_000, "trimestral")).toBe(100_000);
  });
});

describe("fechasEnRango", () => {
  it("lista las ocurrencias del mes desde la n-ésima", () => {
    expect(fechasEnRango("2026-01-31", "mensual", 0, "2026-02-01", "2026-02-28")).toEqual(["2026-02-28"]);
    expect(fechasEnRango("2026-11-01", "semanal", 0, "2026-11-01", "2026-11-30")).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
  });

  it("omite las ocurrencias ya generadas", () => {
    expect(fechasEnRango("2026-11-01", "semanal", 2, "2026-11-01", "2026-11-30")).toEqual(["2026-11-15", "2026-11-22", "2026-11-29"]);
  });
});
