import { describe, expect, it } from "vitest";
import { buscarSugerencia, type Sugerencia } from "./sugerencias";

const lista: Sugerencia[] = [
  { texto: "Terpel", tipo: "gasto", category_id: "transporte", account_id: "visa" },
  { texto: "Droguería La Rebaja", tipo: "gasto", category_id: "salud", account_id: "nequi" },
  { texto: "Honorarios diseño", tipo: "ingreso", category_id: "honorarios", account_id: "davivienda" },
];

describe("buscarSugerencia", () => {
  it("igual, sin tildes ni mayúsculas", () => {
    expect(buscarSugerencia("terpel", "gasto", lista)?.category_id).toBe("transporte");
    expect(buscarSugerencia("DROGUERIA la rebaja", "gasto", lista)?.category_id).toBe("salud");
  });

  it("lo escrito es el comienzo de uno reciente, o al revés", () => {
    expect(buscarSugerencia("drog", "gasto", lista)?.category_id).toBe("salud");
    expect(buscarSugerencia("Terpel Calle 80", "gasto", lista)?.category_id).toBe("transporte");
  });

  it("respeta el tipo y pide al menos 3 letras", () => {
    expect(buscarSugerencia("honorarios", "gasto", lista)).toBeUndefined();
    expect(buscarSugerencia("honorarios", "ingreso", lista)?.category_id).toBe("honorarios");
    expect(buscarSugerencia("te", "gasto", lista)).toBeUndefined();
  });
});
