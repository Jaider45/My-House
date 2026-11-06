import { describe, expect, it } from "vitest";
import { evaluarContrasena, verificoCorreoHacePoco } from "./contrasena";

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

describe("verificoCorreoHacePoco", () => {
  const ahora = 1_800_000_000_000;
  const s = ahora / 1000;
  it("acepta recuperación o código de hace menos de una hora", () => {
    expect(verificoCorreoHacePoco([{ method: "recovery", timestamp: s - 60 }], ahora)).toBe(true);
    expect(verificoCorreoHacePoco([{ method: "otp", timestamp: s - 3500 }], ahora)).toBe(true);
  });
  it("rechaza contraseña, sesiones viejas y datos raros", () => {
    expect(verificoCorreoHacePoco([{ method: "password", timestamp: s }], ahora)).toBe(false);
    expect(verificoCorreoHacePoco([{ method: "otp", timestamp: s - 3700 }], ahora)).toBe(false);
    expect(verificoCorreoHacePoco(["otp"], ahora)).toBe(false);
    expect(verificoCorreoHacePoco(undefined, ahora)).toBe(false);
  });
});
