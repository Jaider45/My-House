import { describe, expect, it } from "vitest";
import { cantidadVariables, dentroDelHorario, parametrosDeUso } from "./usos";

describe("usos de WhatsApp", () => {
  it("arma los parámetros en el orden del uso, sin saltos de línea", () => {
    expect(parametrosDeUso({ plantilla: "x", variables: ["nombre", "monto", "baja"] }, { nombre: "Ana", monto: "$ 19.900", baja: undefined })).toEqual(["Ana", "$ 19.900", ""]);
    expect(parametrosDeUso({ plantilla: "x", variables: ["texto"] }, { texto: "uno\n\n dos" })).toEqual(["uno dos"]);
  });
  it("cuenta las variables distintas del cuerpo", () => {
    expect(cantidadVariables("Hola {{1}}, tu plan {{2}} vence. {{1}}")).toBe(2);
    expect(cantidadVariables("Sin variables")).toBe(0);
  });
  it("respeta el horario de Bogotá y el domingo", () => {
    const e = { wa_desde: "07:00", wa_hasta: "20:00", wa_sin_marketing_domingo: true };
    expect(dentroDelHorario(new Date("2026-11-13T15:00:00Z"), e)).toBe(true); // viernes 10:00
    expect(dentroDelHorario(new Date("2026-11-14T02:00:00Z"), e)).toBe(false); // viernes 21:00
    expect(dentroDelHorario(new Date("2026-11-15T15:00:00Z"), e)).toBe(false); // domingo
    expect(dentroDelHorario(new Date("2026-11-15T15:00:00Z"), { ...e, wa_sin_marketing_domingo: false })).toBe(true);
  });
});
