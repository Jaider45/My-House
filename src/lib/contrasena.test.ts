import { describe, expect, it } from "vitest";
import { evaluarContrasena } from "./contrasena";

describe("evaluarContrasena", () => {
  it("cuenta lo que falta para el mínimo", () => {
    expect(evaluarContrasena("")).toMatchObject({ nivel: 0, consejo: "Mínimo 8 caracteres." });
    expect(evaluarContrasena("abcdefg")).toMatchObject({ nivel: 0, consejo: "Falta 1 carácter." });
    expect(evaluarContrasena("abc")).toMatchObject({ nivel: 0, consejo: "Faltan 5 caracteres." });
  });

  it("castiga las comunes y las repetitivas aunque sean largas", () => {
    expect(evaluarContrasena("Password2026!").nivel).toBe(1);
    expect(evaluarContrasena("aaaaaaaaaaaaaa").nivel).toBe(1);
    expect(evaluarContrasena("1234567890").nivel).toBe(1);
  });

  it("sube con el largo y la variedad", () => {
    expect(evaluarContrasena("casaverde").nivel).toBe(1);
    expect(evaluarContrasena("casaverde7").nivel).toBe(2);
    expect(evaluarContrasena("Casa-verde-del-río").nivel).toBe(3);
    expect(evaluarContrasena("Clave-de-prueba-123")).toMatchObject({ nivel: 3, etiqueta: "Fuerte", consejo: "" });
  });
});
