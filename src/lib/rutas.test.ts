import { describe, expect, it } from "vitest";
import { destinoSeguro, esRutaPublica } from "./rutas";

describe("rutas", () => {
  it("reconoce rutas públicas", () => {
    expect(esRutaPublica("/ingresar")).toBe(true);
    expect(esRutaPublica("/invitacion/abc")).toBe(true);
    expect(esRutaPublica("/ingresarx")).toBe(false);
    expect(esRutaPublica("/")).toBe(false);
  });

  it("solo acepta destinos internos", () => {
    expect(destinoSeguro("/movimientos")).toBe("/movimientos");
    expect(destinoSeguro("//evil.com")).toBe("/");
    expect(destinoSeguro("/\\evil.com")).toBe("/");
    expect(destinoSeguro("https://evil.com")).toBe("/");
    expect(destinoSeguro(null, "/x")).toBe("/x");
  });
});
