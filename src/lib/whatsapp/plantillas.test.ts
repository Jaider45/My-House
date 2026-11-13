import { describe, expect, it } from "vitest";
import { conEjemplos, cuerpoMeta, estadoDeMeta, revisar, variables, type Plantilla } from "./plantillas";

const base: Plantilla = {
  nombre: "recordatorio_pago",
  idioma: "es",
  categoria: "UTILITY",
  encabezado: "Pago por vencer",
  cuerpo: "Hola {{1}}. El {{2}} vence tu pago de *{{3}}* por {{4}}. Responde PAGADO cuando lo pagues.",
  ejemplos: ["Andrés", "viernes 20", "Tarjeta Visa", "$520.000"],
  pie: "My House · Finanzas del hogar",
  botones: [{ tipo: "QUICK_REPLY", texto: "Ya lo pagué" }],
};

describe("plantillas de WhatsApp", () => {
  it("acepta la plantilla del diseño", () => {
    expect(revisar(base).errores).toEqual([]);
  });
  it("lee las variables en orden y arma la vista previa", () => {
    expect(variables(base.cuerpo)).toEqual([1, 2, 3, 4]);
    expect(conEjemplos("Hola {{1}}", ["Ana"])).toBe("Hola Ana");
  });
  it("exige variables en orden, con ejemplo y no al final", () => {
    expect(revisar({ ...base, cuerpo: "Hola {{2}} y {{1}}, tu pago." }).errores.join(" ")).toMatch(/en orden/);
    expect(revisar({ ...base, ejemplos: ["Andrés"] }).errores.join(" ")).toMatch(/Falta el ejemplo/);
    expect(revisar({ ...base, cuerpo: "Tu pago vence el {{1}}", ejemplos: ["viernes"] }).errores.join(" ")).toMatch(/terminar con una variable/);
  });
  it("valida nombre y botones de enlace", () => {
    expect(revisar({ ...base, nombre: "Recordatorio Pago" }).errores.length).toBeGreaterThan(0);
    expect(revisar({ ...base, botones: [{ tipo: "URL", texto: "Ver", url: "http://x" }] }).errores.join(" ")).toMatch(/https/);
  });
  it("avisa cuando parece pedir datos bancarios", () => {
    expect(revisar({ ...base, cuerpo: "Hola {{1}}, envíanos tu contraseña del banco hoy mismo por favor." }).avisos.length).toBeGreaterThan(0);
  });
  it("arma el cuerpo para Meta con ejemplos", () => {
    const c = cuerpoMeta(base);
    expect(c.components.map((x) => x.type)).toEqual(["HEADER", "BODY", "FOOTER", "BUTTONS"]);
    expect((c.components[1] as { example: { body_text: string[][] } }).example.body_text[0]).toHaveLength(4);
    expect(estadoDeMeta("APPROVED")).toBe("aprobada");
    expect(estadoDeMeta("REJECTED")).toBe("rechazada");
  });
});
