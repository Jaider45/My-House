import { describe, expect, it } from "vitest";
import { describirHogar, edad, fusionarConfigHogar, leerConfigHogar, type PersonaHogar } from ".";

describe("configuración del hogar", () => {
  it("da valores por defecto a una configuración vacía o vieja", () => {
    expect(leerConfigHogar({})).toEqual({ cuota_imprevistos_pct: 10, contexto: "", ia: { proveedor: null, modelo: null }, correo: { resumen_semanal: false, bienvenida_enviada: false } });
    expect(leerConfigHogar(null).cuota_imprevistos_pct).toBe(10);
    expect(leerConfigHogar({ cuota_imprevistos_pct: 15 }).cuota_imprevistos_pct).toBe(15);
  });

  it("descarta valores inválidos sin romper el resto", () => {
    const c = leerConfigHogar({ cuota_imprevistos_pct: 99, contexto: 5, ia: { proveedor: "gemini", modelo: "gpt 4; drop" } });
    expect(c).toEqual({ cuota_imprevistos_pct: 10, contexto: "", ia: { proveedor: null, modelo: null }, correo: { resumen_semanal: false, bienvenida_enviada: false } });
    expect(leerConfigHogar({ correo: { resumen_semanal: "sí" } }).correo).toEqual({ resumen_semanal: false, bienvenida_enviada: false });
    expect(leerConfigHogar({ correo: { resumen_semanal: true } }).correo.resumen_semanal).toBe(true);
    expect(leerConfigHogar({ ia: { proveedor: "openai", modelo: "gpt-4.1" } }).ia).toEqual({ proveedor: "openai", modelo: "gpt-4.1" });
  });

  it("al fusionar no borra lo que guardó otra pantalla ni claves desconocidas", () => {
    const actual = { cuota_imprevistos_pct: 12, ia: { proveedor: "openai", modelo: "gpt-4.1" }, futura: true };
    const nueva = fusionarConfigHogar(actual, { contexto: "Somos cuatro" });
    expect(nueva).toEqual({ cuota_imprevistos_pct: 12, contexto: "Somos cuatro", ia: { proveedor: "openai", modelo: "gpt-4.1" }, correo: { resumen_semanal: false, bienvenida_enviada: false }, futura: true });
    expect(fusionarConfigHogar(nueva, { cuota_imprevistos_pct: 5 })).toMatchObject({ cuota_imprevistos_pct: 5, contexto: "Somos cuatro", futura: true });
  });
});

describe("personas a cargo", () => {
  it("calcula la edad cumplida", () => {
    expect(edad("2017-11-05", "2026-11-05")).toBe(9);
    expect(edad("2017-11-06", "2026-11-05")).toBe(8);
    expect(edad("2008-02-29", "2026-02-28")).toBe(17);
    expect(edad("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("describe el hogar para el asistente", () => {
    const personas: PersonaHogar[] = [
      { id: "a", nombre: "Andrés", es_dependiente: false, parentesco: null, fecha_nacimiento: null, a_cargo_de: null, nota: null },
      { id: "s", nombre: "Sofía", es_dependiente: true, parentesco: "hijo", fecha_nacimiento: "2017-03-10", a_cargo_de: "a", nota: "va al colegio" },
    ];
    const texto = describirHogar(personas, "  Tenemos un perro. ", "2026-11-05");
    expect(texto).toContain("- Andrés: adulto con acceso a la app");
    expect(texto).toContain("- Sofía: persona a cargo, hijo o hija, 9 años, a cargo de Andrés, va al colegio");
    expect(texto).toContain("Lo que la familia cuenta del hogar: Tenemos un perro.");
    expect(describirHogar([], "", "2026-11-05")).toBe("");
  });
});
