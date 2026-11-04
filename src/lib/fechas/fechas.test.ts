import { describe, expect, it } from "vitest";
import { formatearFecha, hoy, mesDe, parsearFecha, rangoMes, sumarMeses } from ".";

describe("hoy", () => {
  it("usa la hora de Bogotá (UTC-5)", () => {
    expect(hoy(new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-04");
    expect(hoy(new Date("2026-11-05T06:00:00Z"))).toBe("2026-11-05");
  });
});

describe("meses", () => {
  it("calcula el rango, incluso en bisiestos", () => {
    expect(rangoMes("2026-02")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rangoMes("2028-02").hasta).toBe("2028-02-29");
    expect(rangoMes("2026-12").hasta).toBe("2026-12-31");
  });

  it("suma y resta meses cruzando años", () => {
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
    expect(sumarMeses("2026-11", 3)).toBe("2027-02");
    expect(sumarMeses("2026-03", -3)).toBe("2025-12");
    expect(mesDe("2026-11-04")).toBe("2026-11");
  });
});

describe("parsearFecha", () => {
  it.each([
    ["2026-11-04", "2026-11-04"],
    ["2026/11/4", "2026-11-04"],
    ["04/11/2026", "2026-11-04"],
    ["4-11-2026", "2026-11-04"],
    ["04/11/26", "2026-11-04"],
    ["04.11.2026", "2026-11-04"],
    ["2026-11-04T10:00:00", "2026-11-04"],
    ["29/02/2028", "2028-02-29"],
  ])("%s → %s", (texto, esperado) => {
    expect(parsearFecha(texto)).toBe(esperado);
  });

  it.each(["31/02/2026", "13/13/2026", "hoy", "", "2026-11"])("rechaza %j", (texto) => {
    expect(parsearFecha(texto)).toBeNull();
  });
});

describe("formatearFecha", () => {
  it("da formato corto en español", () => {
    expect(formatearFecha("2026-11-04")).toBe("4 de nov de 2026");
  });
});
