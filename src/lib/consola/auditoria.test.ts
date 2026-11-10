import { describe, expect, it } from "vitest";
import { celdaCsv, describirAccion } from "./auditoria";

describe("describirAccion", () => {
  it("arma la frase con el objeto y el detalle", () => {
    expect(describirAccion({ accion: "invito_persona", objeto_nombre: "Daniela", detalle: { rol: "soporte" } })).toBe("Invitó a Daniela como Soporte");
    expect(describirAccion({ accion: "cambio_rol", objeto_nombre: "Mateo", detalle: { antes: "soporte", despues: "finanzas" } })).toBe(
      "Cambió el rol de Mateo: Soporte → Finanzas",
    );
    expect(describirAccion({ accion: "ingreso_consola", objeto_nombre: null, detalle: {} })).toBe("Ingresó a la consola");
  });

  it("una acción desconocida se muestra legible", () => {
    expect(describirAccion({ accion: "algo_nuevo", objeto_nombre: null, detalle: null })).toBe("algo nuevo");
  });
});

describe("celdaCsv", () => {
  it("escapa comillas y neutraliza fórmulas", () => {
    expect(celdaCsv('Hola "tú"')).toBe('"Hola ""tú"""');
    expect(celdaCsv("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(celdaCsv(null)).toBe('""');
    expect(celdaCsv({ rol: "soporte" })).toBe('"{""rol"":""soporte""}"');
  });
});
