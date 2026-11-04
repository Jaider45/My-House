import { describe, expect, it } from "vitest";
import { construirArbol, opcionesCategoria, raizDe, type Categoria } from ".";

const cat = (id: string, nombre: string, padre_id: string | null = null, extra: Partial<Categoria> = {}): Categoria => ({
  id, nombre, padre_id, clase: "gasto", tipo: "variable", es_esencial: false, excluir_de_costo_vida: false, archivada: false, ...extra,
});

const lista = [
  cat("v", "Vivienda"),
  cat("m", "Mercado"),
  cat("va", "Arriendo", "v"),
  cat("vad", "Administración", "v"),
  cat("s", "Salario", null, { clase: "ingreso" }),
  cat("x", "Vieja", null, { archivada: true }),
];

describe("construirArbol", () => {
  it("agrupa hijas bajo su padre y ordena por nombre", () => {
    const arbol = construirArbol(lista.filter((c) => c.clase === "gasto"));
    expect(arbol.map((n) => n.nombre)).toEqual(["Mercado", "Vieja", "Vivienda"]);
    expect(arbol[2].hijas.map((h) => h.nombre)).toEqual(["Administración", "Arriendo"]);
  });

  it("trata como raíz a una hija huérfana", () => {
    expect(construirArbol([cat("h", "Huérfana", "no-existe")]).map((n) => n.id)).toEqual(["h"]);
  });
});

describe("opcionesCategoria", () => {
  it("lista activas de la clase con la ruta completa", () => {
    expect(opcionesCategoria(lista, "gasto").map((o) => o.etiqueta)).toEqual([
      "Mercado",
      "Vivienda",
      "Vivienda › Administración",
      "Vivienda › Arriendo",
    ]);
    expect(opcionesCategoria(lista, "ingreso").map((o) => o.etiqueta)).toEqual(["Salario"]);
  });
});

describe("raizDe", () => {
  it("devuelve el padre de una subcategoría y la misma si es raíz", () => {
    const mapa = new Map(lista.map((c) => [c.id, c]));
    expect(raizDe(mapa, "va")?.id).toBe("v");
    expect(raizDe(mapa, "m")?.id).toBe("m");
    expect(raizDe(mapa, "nada")).toBeUndefined();
  });
});
