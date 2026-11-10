import { describe, expect, it } from "vitest";
import { formatearFechaCorta, formatearMomento } from "./formato";

// 9 nov 2026, 3:00 p. m. en Bogotá (UTC−5).
const ahora = new Date("2026-11-09T20:00:00Z");

describe("formatearMomento", () => {
  it("hoy y ayer según la hora de Bogotá", () => {
    expect(formatearMomento("2026-11-09T13:14:00Z", ahora)).toBe("Hoy, 8:14 a. m.");
    expect(formatearMomento("2026-11-08T23:30:00Z", ahora)).toBe("Ayer, 6:30 p. m.");
    // 3:00 UTC del 9 = 10:00 p. m. del 8 en Bogotá: es ayer, no hoy.
    expect(formatearMomento("2026-11-09T03:00:00Z", ahora)).toBe("Ayer, 10:00 p. m.");
  });

  it("antes de ayer con fecha corta", () => {
    expect(formatearMomento("2026-11-04T14:02:00Z", ahora)).toBe("4 nov 2026, 9:02 a. m.");
  });

  it("vacío o inválido", () => {
    expect(formatearMomento(null, ahora)).toBe("—");
    expect(formatearMomento("no es fecha", ahora)).toBe("—");
  });
});

describe("formatearFechaCorta", () => {
  it("día, mes corto y año", () => {
    expect(formatearFechaCorta("2026-11-16T04:00:00Z")).toBe("15 nov 2026");
    expect(formatearFechaCorta(undefined)).toBe("—");
  });
});
