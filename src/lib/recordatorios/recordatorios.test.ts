import { describe, expect, it } from "vitest";
import { proximaFecha, textoAviso } from ".";

describe("proximaFecha", () => {
  it("una sola vez conserva la fecha aunque ya haya pasado", () => {
    expect(proximaFecha("2026-10-01", "una_vez", "2026-11-05")).toBe("2026-10-01");
  });

  it("mensual avanza al próximo mes y ajusta el día 31", () => {
    expect(proximaFecha("2026-01-31", "mensual", "2026-11-05")).toBe("2026-11-30");
    expect(proximaFecha("2026-01-05", "mensual", "2026-11-05")).toBe("2026-11-05");
  });

  it("anual pasa al año siguiente si ya pasó", () => {
    expect(proximaFecha("2026-02-14", "anual", "2026-11-05")).toBe("2027-02-14");
    expect(proximaFecha("2027-02-14", "anual", "2026-11-05")).toBe("2027-02-14");
  });
});

describe("textoAviso", () => {
  it("nombra la anticipación", () => {
    expect([0, 1, 3, 7, 14, 30].map(textoAviso)).toEqual(["El mismo día", "1 día antes", "3 días antes", "1 semana antes", "2 semanas antes", "1 mes antes"]);
  });
});
