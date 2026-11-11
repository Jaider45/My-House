import { describe, expect, it } from "vitest";
import { leerPrecios, preciosATexto } from "./precios-ia";

describe("precios de IA", () => {
  it("lee «modelo: entrada, salida» y vuelve a texto", () => {
    const r = leerPrecios("claude-opus: 5, 25\nGPT-6.1 = 2.5/10\n");
    expect(r).toEqual({ precios: { "claude-opus": [5, 25], "gpt-6.1": [2.5, 10] } });
    if ("precios" in r) expect(preciosATexto(r.precios)).toBe("claude-opus: 5, 25\ngpt-6.1: 2.5, 10");
  });

  it("vacío = sin precios; una línea mala se explica", () => {
    expect(leerPrecios("  ")).toEqual({ precios: {} });
    expect(leerPrecios("claude-opus: cinco")).toEqual({ error: expect.stringMatching(/Línea 1/) });
  });
});
