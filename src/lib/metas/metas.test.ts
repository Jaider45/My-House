import { describe, expect, it } from "vitest";
import { avanceMeta } from ".";

describe("avanceMeta", () => {
  it("calcula el aporte sugerido y la llegada con el aporte actual", () => {
    // Faltan 7.800.000 en 7 meses (noviembre a junio): 1.114.286 al mes; con 900.000 se llega en 9 meses.
    expect(avanceMeta({ objetivo: 29_000_000, ahorrado: 21_200_000, aporteMensual: 900_000, fechaObjetivo: "2027-06-30" }, "2026-11-05")).toEqual({
      porcentaje: 73,
      falta: 7_800_000,
      meses: 7,
      aporteSugerido: 1_114_286,
      llegada: "2027-08",
      estado: "atrasada",
    });
  });

  it("a tiempo cuando el aporte alcanza, cumplida cuando ya se llegó", () => {
    expect(avanceMeta({ objetivo: 1_200, ahorrado: 0, aporteMensual: 200, fechaObjetivo: "2027-05-01" }, "2026-11-05").estado).toBe("a_tiempo");
    expect(avanceMeta({ objetivo: 1_000, ahorrado: 1_500, aporteMensual: null, fechaObjetivo: null }, "2026-11-05")).toMatchObject({
      estado: "cumplida",
      porcentaje: 100,
    });
  });

  it("sin aporte ni fecha no hay plan", () => {
    expect(avanceMeta({ objetivo: 1_000, ahorrado: 100, aporteMensual: null, fechaObjetivo: null }, "2026-11-05").estado).toBe("sin_plan");
  });
});
