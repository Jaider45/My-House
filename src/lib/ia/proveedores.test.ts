import { describe, expect, it } from "vitest";
import { MODELO_POR_DEFECTO, proveedoresDisponibles, resolverIa } from "./proveedores";

const ninguno = { proveedor: null, modelo: null };

describe("proveedor de IA del hogar", () => {
  it("sin llaves no hay asistente", () => {
    expect(proveedoresDisponibles({})).toEqual([]);
    expect(resolverIa(ninguno, { ANTHROPIC_API_KEY: "  " })).toBeNull();
  });

  it("usa el único proveedor con llave y su modelo por defecto", () => {
    expect(resolverIa(ninguno, { OPENAI_API_KEY: "sk" })).toEqual({ proveedor: "openai", modelo: MODELO_POR_DEFECTO.openai });
    expect(resolverIa(ninguno, { ANTHROPIC_API_KEY: "sk" })).toEqual({ proveedor: "anthropic", modelo: "claude-opus-5-5" });
  });

  it("con las dos llaves respeta IA_PROVEEDOR y el modelo del entorno", () => {
    const env = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", IA_PROVEEDOR: "OpenAI", OPENAI_MODEL: "gpt-4.1" };
    expect(resolverIa(ninguno, env)).toEqual({ proveedor: "openai", modelo: "gpt-4.1" });
    expect(resolverIa(ninguno, { ...env, IA_PROVEEDOR: undefined })).toEqual({ proveedor: "anthropic", modelo: "claude-opus-5-5" });
  });

  it("lo que eligió el hogar manda, si ese proveedor tiene llave", () => {
    const env = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", IA_PROVEEDOR: "anthropic" };
    expect(resolverIa({ proveedor: "openai", modelo: "gpt-5.4-mini" }, env)).toEqual({ proveedor: "openai", modelo: "gpt-5.4-mini" });
    expect(resolverIa({ proveedor: "openai", modelo: null }, env)).toEqual({ proveedor: "openai", modelo: MODELO_POR_DEFECTO.openai });
    // Eligió OpenAI pero el servidor ya no tiene esa llave: se usa la que hay, sin arrastrar el modelo de GPT.
    expect(resolverIa({ proveedor: "openai", modelo: "gpt-4.1" }, { ANTHROPIC_API_KEY: "a" })).toEqual({ proveedor: "anthropic", modelo: "claude-opus-5-5" });
  });

  it("ignora nombres de modelo inválidos", () => {
    expect(resolverIa({ proveedor: "anthropic", modelo: "../../etc" }, { ANTHROPIC_API_KEY: "a", ANTHROPIC_MODEL: "claude sonnet" })?.modelo).toBe("claude-opus-5-5");
  });
});
