import { describe, expect, it } from "vitest";
import { bloques, reemplazarVariables } from "./markdown";
import { diffPalabras, diffTexto } from "./diff";

describe("markdown", () => {
  it("arma títulos, párrafos, listas y citas", () => {
    expect(bloques("## Uno\nTexto en\ndos líneas\n\n- a\n- b\n1. x\n> ojo")).toEqual([
      { tipo: "h2", texto: "Uno" },
      { tipo: "p", texto: "Texto en dos líneas" },
      { tipo: "ul", items: ["a", "b"] },
      { tipo: "ol", items: ["x"] },
      { tipo: "cita", texto: "ojo" },
    ]);
  });
  it("reemplaza solo las variables conocidas", () => {
    expect(reemplazarVariables("{nombre} y {otra}", { nombre: "Ana" })).toBe("Ana y {otra}");
  });
});

describe("diff", () => {
  it("marca palabras nuevas y quitadas", () => {
    const d = diffPalabras("proveedor de alojamiento, proveedor de correo.", "proveedor de IA; proveedor de alojamiento.");
    expect(d.filter((t) => t.tipo === "mas").map((t) => t.texto.trim())).toContain("IA;");
    expect(d.some((t) => t.tipo === "menos")).toBe(true);
  });
  it("junta un párrafo quitado y uno nuevo en uno cambiado", () => {
    const d = diffTexto("Uno.\n\nDos viejo.\n\nTres.", "Uno.\n\nDos nuevo.\n\nTres.\n\nCuatro.");
    expect(d.map((p) => p.tipo)).toEqual(["igual", "cambiado", "igual", "nuevo"]);
  });
});
