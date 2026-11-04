import { describe, expect, it } from "vitest";
import type { Categoria } from "@/lib/categorias";
import { resumirMes, type TotalCategoria } from ".";

const cat = (id: string, tipo: "fijo" | "variable", es_esencial: boolean, extra: Partial<Categoria> = {}): Categoria => ({
  id, nombre: id, padre_id: null, clase: "gasto", tipo, es_esencial, excluir_de_costo_vida: false, archivada: false, ...extra,
});

const categorias: Categoria[] = [
  cat("vivienda", "fijo", true),
  cat("arriendo", "fijo", true, { padre_id: "vivienda" }),
  cat("mercado", "variable", true),
  cat("ocio", "variable", false),
  cat("ahorro", "variable", false, { excluir_de_costo_vida: true }),
  cat("salario", "fijo", false, { clase: "ingreso" }),
];

const g = (mes: string, category_id: string | null, total: number, estado: "confirmado" | "programado" = "confirmado"): TotalCategoria => ({
  mes: `${mes}-01`, category_id, tipo: "gasto", estado, total,
});

const base = { categorias, personas: 4, cuotaImprevistosPct: 10 };

describe("resumirMes", () => {
  it("separa fijos y variables, excluye el ahorro del costo de vida y agrupa por categoría raíz", () => {
    const r = resumirMes({
      ...base,
      mes: "2026-11",
      filas: [
        { mes: "2026-11-01", category_id: "salario", tipo: "ingreso", estado: "confirmado", total: 9_000_000 },
        g("2026-11", "arriendo", 1_800_000, "programado"),
        g("2026-11", "mercado", 900_000),
        g("2026-11", "ocio", 300_000),
        g("2026-11", "ahorro", 1_000_000),
        g("2026-11", null, 50_000),
      ],
    });
    expect(r.ingresos).toBe(9_000_000);
    expect(r.gastos).toBe(2_250_000);
    expect(r.porPagar).toBe(1_800_000);
    expect(r.ahorro).toBe(1_000_000);
    expect(r.fijos).toBe(1_800_000);
    expect(r.variables).toBe(1_250_000);
    expect(r.costoVida).toBe(3_050_000);
    expect(r.costoPorPersona).toBe(762_500);
    expect(r.porCategoria).toEqual([
      { id: "vivienda", nombre: "vivienda", total: 1_800_000 },
      { id: "mercado", nombre: "mercado", total: 900_000 },
      { id: "ocio", nombre: "ocio", total: 300_000 },
      { id: null, nombre: "Sin categoría", total: 50_000 },
    ]);
  });

  it("número mínimo: fijos del mes + variables esenciales promedio de 3 meses cerrados + cuota de imprevistos", () => {
    const r = resumirMes({
      ...base,
      mes: "2026-11",
      filas: [
        g("2026-08", "mercado", 800_000),
        g("2026-09", "mercado", 1_000_000),
        g("2026-10", "mercado", 1_200_000),
        g("2026-10", "ocio", 999_999), // no esencial: no cuenta
        g("2026-11", "arriendo", 1_800_000),
        g("2026-11", "mercado", 100_000), // mes en curso: no se usa porque hay historia
      ],
    });
    expect(r.numeroMinimo).toEqual({
      fijos: 1_800_000,
      variablesEsenciales: 1_000_000,
      mesesPromedio: 3,
      imprevistos: 280_000,
      total: 3_080_000,
    });
  });

  it("promedia solo los meses con datos y usa el mes actual si no hay historia", () => {
    const conUno = resumirMes({ ...base, mes: "2026-11", filas: [g("2026-09", "mercado", 600_000), g("2026-11", "mercado", 50_000)] });
    expect(conUno.numeroMinimo).toMatchObject({ variablesEsenciales: 600_000, mesesPromedio: 1 });

    const soloImportado = resumirMes({ ...base, mes: "2026-11", filas: [g("2026-10", null, 900_000), g("2026-11", "mercado", 70_000)] });
    expect(soloImportado.numeroMinimo).toMatchObject({ variablesEsenciales: 70_000, mesesPromedio: 0 });

    const sinHistoria = resumirMes({ ...base, mes: "2026-11", filas: [g("2026-11", "mercado", 450_000)] });
    expect(sinHistoria.numeroMinimo).toMatchObject({ variablesEsenciales: 450_000, mesesPromedio: 0, imprevistos: 45_000, total: 495_000 });
  });

  it("con cuota 0 y sin datos todo da cero", () => {
    const r = resumirMes({ ...base, cuotaImprevistosPct: 0, mes: "2026-01", filas: [] });
    expect(r.numeroMinimo.total).toBe(0);
    expect(r.costoPorPersona).toBe(0);
    expect(r.porCategoria).toEqual([]);
  });

  it("cruza el año al buscar los meses anteriores", () => {
    const r = resumirMes({ ...base, mes: "2027-01", filas: [g("2026-12", "mercado", 700_000), g("2026-11", "mercado", 500_000)] });
    expect(r.numeroMinimo).toMatchObject({ variablesEsenciales: 600_000, mesesPromedio: 2 });
  });
});
