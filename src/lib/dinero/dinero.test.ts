import { describe, expect, it } from "vitest";
import { digitosAMonto, formatearCOP, formatearMiles, parsearMonto, porcentaje } from ".";

describe("formateo es-CO", () => {
  it("usa punto de miles y sin decimales", () => {
    expect(formatearMiles(1234567)).toBe("1.234.567");
    expect(formatearCOP(1234567).replace(/\s/g, " ")).toBe("$ 1.234.567");
    expect(formatearCOP(0).replace(/\s/g, " ")).toBe("$ 0");
  });
});

describe("digitosAMonto", () => {
  it("ignora todo lo que no sea dígito", () => {
    expect(digitosAMonto("1.234.567")).toBe(1234567);
    expect(digitosAMonto("$ 45.000")).toBe(45000);
    expect(digitosAMonto("")).toBe(0);
    expect(digitosAMonto("000")).toBe(0);
  });
});

describe("parsearMonto", () => {
  it.each([
    ["1.234.567", 1234567],
    ["1,234,567.00", 1234567],
    ["1.234.567,00", 1234567],
    ["-45.000,50", -45001],
    ["45.000,49", 45000],
    ["(12.000)", -12000],
    ["$ 3.500-", -3500],
    ["$ 3.500", 3500],
    ["1,234", 1234],
    ["12,5", 13],
    ["150000", 150000],
    ["0", 0],
    ["-0,00", 0],
  ])("%s → %d", (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it.each(["", "abc", "-", "1-2-3x."])("rechaza %j", (texto) => {
    expect(parsearMonto(texto)).toBeNull();
  });
});

describe("porcentaje", () => {
  it("redondea y no divide por cero", () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(2, 3)).toBe(67);
    expect(porcentaje(5, 0)).toBe(0);
  });
});
