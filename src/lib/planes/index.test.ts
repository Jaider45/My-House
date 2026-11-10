import { describe, expect, it } from "vitest";
import { ahorroAnual, diasDePrueba, porcentajeUso, textoLimite } from ".";

describe("textoLimite", () => {
  it("muestra cada límite como en el diseño", () => {
    expect(textoLimite("almacenamiento_mb", 200)).toBe("200 MB");
    expect(textoLimite("almacenamiento_mb", 2048)).toBe("2 GB");
    expect(textoLimite("almacenamiento_mb", 20480)).toBe("20 GB");
    expect(textoLimite("comprobantes_mes", null)).toBe("Ilimitados");
    expect(textoLimite("metas", true)).toBe("Incluido");
    expect(textoLimite("comision_pct", 20)).toBe("20 %");
    expect(textoLimite("personas", 5)).toBe("5");
  });
});

describe("porcentajeUso", () => {
  it("recorta a 100 y no aplica sin tope", () => {
    expect(porcentajeUso(1, 2)).toBe(50);
    expect(porcentajeUso(7, 5)).toBe(100);
    expect(porcentajeUso(3, null)).toBeNull();
  });
});

describe("ahorroAnual", () => {
  it("$199.000 al año frente a $19.900 al mes = 2 meses gratis", () => {
    expect(ahorroAnual(19_900, 199_000)).toEqual({ pesos: 39_800, meses: 2 });
    expect(ahorroAnual(0, 0)).toEqual({ pesos: 0, meses: 0 });
  });
});

describe("diasDePrueba", () => {
  const ahora = new Date("2026-11-10T12:00:00Z");
  it("redondea hacia arriba y es 0 al terminar", () => {
    expect(diasDePrueba("2026-11-24T12:00:00Z", ahora)).toBe(14);
    expect(diasDePrueba("2026-11-10T13:00:00Z", ahora)).toBe(1);
    expect(diasDePrueba("2026-11-09T12:00:00Z", ahora)).toBe(0);
    expect(diasDePrueba(null, ahora)).toBe(0);
  });
});
