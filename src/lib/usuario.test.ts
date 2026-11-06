import { describe, expect, it } from "vitest";
import { nombreDe } from "./usuario";

describe("nombreDe", () => {
  it("prefiere el nombre del registro y si no, el primero de Google", () => {
    expect(nombreDe({ nombre: "Andrés", full_name: "Andrés Martínez" })).toBe("Andrés");
    expect(nombreDe({ full_name: "Camila Rojas Díaz" })).toBe("Camila");
    expect(nombreDe({ name: "Beto" })).toBe("Beto");
    expect(nombreDe({})).toBe("");
    expect(nombreDe(undefined)).toBe("");
  });
});
