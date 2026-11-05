import { describe, expect, it } from "vitest";
import { colombia, semaforo } from "./co";
import { jurisdiccion, peorSemaforo } from "./registro";
import type { Acumulados, ParametrosAnio } from "./tipos";

const topes = { patrimonio_bruto: 4500, ingresos_brutos: 1400, consumos_tarjeta: 1400, compras_consumos: 1400, consignaciones: 1400 };
const p2025: ParametrosAnio = { anio: 2025, uvt_valor: 49_799, topes };
const p2026: ParametrosAnio = { anio: 2026, uvt_valor: 52_374, topes };
const cero: Acumulados = { member_id: "m", nombre: "Ana", ingresos_brutos: 0, consumos_tarjeta: 0, compras_consumos: 0, consignaciones: 0, patrimonio_bruto: 0 };

describe("topes en pesos a partir de UVT", () => {
  it("2025: UVT 49.799", () => {
    const r = Object.fromEntries(colombia.evaluarTopes(p2025, cero).map((t) => [t.clave, t.tope]));
    expect(r.ingresos_brutos).toBe(69_718_600);
    expect(r.patrimonio_bruto).toBe(224_095_500);
    expect(r.consumos_tarjeta).toBe(69_718_600);
  });

  it("2026: UVT 52.374", () => {
    const r = Object.fromEntries(colombia.evaluarTopes(p2026, cero).map((t) => [t.clave, t.tope]));
    expect(r.ingresos_brutos).toBe(73_323_600);
    expect(r.compras_consumos).toBe(73_323_600);
    expect(r.consignaciones).toBe(73_323_600);
    expect(r.patrimonio_bruto).toBe(235_683_000);
  });

  it("evalúa los cinco topes", () => {
    expect(colombia.evaluarTopes(p2026, cero).map((t) => t.clave)).toEqual([
      "ingresos_brutos", "patrimonio_bruto", "consumos_tarjeta", "compras_consumos", "consignaciones",
    ]);
  });
});

describe("semáforo", () => {
  const tope = 73_323_600;
  it.each([
    [0, "verde"],
    [Math.ceil(tope * 0.7) - 1, "verde"],
    [Math.ceil(tope * 0.7), "amarillo"],
    [tope - 1, "amarillo"],
    [tope, "rojo"],
    [tope * 2, "rojo"],
  ])("%d → %s", (acumulado, esperado) => {
    expect(semaforo(acumulado, tope)).toBe(esperado);
  });

  it("el porcentaje se trunca: 99,9 % no se muestra como 100 %", () => {
    const [ingresos] = colombia.evaluarTopes(p2026, { ...cero, ingresos_brutos: 73_323_599 });
    expect(ingresos).toMatchObject({ porcentaje: 99, semaforo: "amarillo" });
    const [lleno] = colombia.evaluarTopes(p2026, { ...cero, ingresos_brutos: 73_323_600 });
    expect(lleno).toMatchObject({ porcentaje: 100, semaforo: "rojo" });
  });

  it("peorSemaforo prioriza rojo y luego amarillo", () => {
    const r = colombia.evaluarTopes(p2026, { ...cero, consignaciones: 60_000_000 });
    expect(peorSemaforo(r)).toBe("amarillo");
    expect(peorSemaforo(colombia.evaluarTopes(p2026, { ...cero, patrimonio_bruto: 300_000_000 }))).toBe("rojo");
    expect(peorSemaforo(colombia.evaluarTopes(p2026, cero))).toBe("verde");
  });
});

describe("registro de jurisdicciones", () => {
  it("encuentra Colombia y no inventa países", () => {
    expect(jurisdiccion("co")?.autoridad).toBe("DIAN");
    expect(jurisdiccion("MX")).toBeUndefined();
  });
});

describe("dependientes (Colombia)", () => {
  const d = colombia.dependientes!;
  const deducciones = { dependientes_pct: 10, dependientes_tope_anual: 384, dependiente_adicional: 72, dependientes_max: 4 };

  it.each([
    [{ parentesco: "hijo" as const, edad: 9 }, true, "menor de 18"],
    [{ parentesco: "hijo" as const, edad: 20 }, true, "estudios"],
    [{ parentesco: "hijo" as const, edad: 30 }, true, "condición física"],
    [{ parentesco: "hijo" as const, edad: null }, true, "fecha de nacimiento"],
    [{ parentesco: "padre_madre" as const, edad: 70 }, true, "260 UVT"],
    [{ parentesco: "pareja" as const, edad: 40 }, true, "260 UVT"],
    [{ parentesco: "otro" as const, edad: 50 }, false, "no cuentan"],
    [{ parentesco: null, edad: null }, false, "no cuentan"],
  ])("%o → podría %s", (persona, podria, texto) => {
    const r = d.orientacion(persona);
    expect(r.podria).toBe(podria);
    expect(r.texto).toContain(texto);
  });

  it("calcula los topes en pesos con la UVT del año y respeta el máximo de dependientes", () => {
    const b = d.beneficio(52_374, deducciones, 2)!;
    expect(b.topeAnual).toBe(384 * 52_374);
    expect(b.adicionalPorDependiente).toBe(72 * 52_374);
    expect(b.adicionalTotal).toBe(2 * 72 * 52_374);
    expect(d.beneficio(52_374, deducciones, 6)!.adicionalTotal).toBe(4 * 72 * 52_374);
    expect(d.beneficio(52_374, {}, 1)).toBeNull();
  });
});
