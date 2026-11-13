import { describe, expect, it } from "vitest";
import { dolaresAPesos, formatearTrm, leerTrm } from ".";

describe("TRM", () => {
  it("lee la fila de datos.gov.co", () => {
    expect(leerTrm([{ valor: "3874.52", unidad: "COP", vigenciadesde: "2026-11-14T00:00:00.000", vigenciahasta: "2026-11-14T00:00:00.000" }])).toEqual({ fecha: "2026-11-14", valor: 3874.52 });
    expect(leerTrm([])).toBeNull();
    expect(leerTrm([{ valor: "abc", vigenciadesde: "2026-11-14" }])).toBeNull();
  });

  it("convierte dólares a pesos enteros y formatea", () => {
    expect(dolaresAPesos(12.99, 3874.52)).toBe(50_330);
    expect(formatearTrm(3874.52)).toBe("$ 3.874,52");
  });
});
