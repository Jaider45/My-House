import { describe, expect, it } from "vitest";
import { iconoCategoria } from "./iconos";

describe("iconoCategoria", () => {
  it("reconoce las categorías semilla sin importar tildes ni mayúsculas", () => {
    expect(iconoCategoria("Educación de los hijos")).toBe("educacion");
    expect(iconoCategoria("Servicios públicos")).toBe("servicios");
    expect(iconoCategoria("Ahorro e inversión")).toBe("ahorro");
    expect(iconoCategoria("Rendimientos financieros", "ingreso")).toBe("ahorro");
  });

  it("sin coincidencia usa el ícono de la clase", () => {
    expect(iconoCategoria("Varios")).toBe("egresos");
    expect(iconoCategoria("Otros ingresos", "ingreso")).toBe("ingresos");
    expect(iconoCategoria(null)).toBe("egresos");
  });
});
