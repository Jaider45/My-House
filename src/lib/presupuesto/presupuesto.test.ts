import { describe, expect, it } from "vitest";
import { armarPlan, filasPresupuesto, pronosticar, semaforo, type EntradaCategoria, type ReglaPlan } from ".";

const base: EntradaCategoria = { id: "m", nombre: "Mercado", fijos: 1_200_000, adicional: 400_000, real: 0, programado: 0, promedio3: 1_500_000 };

describe("pronosticar", () => {
  it("proyecta el ritmo del gasto variable en los días que faltan", () => {
    // Variable 300.000 en 10 días → 30.000 por día × 20 días restantes = 600.000.
    expect(pronosticar({ ...base, real: 1_500_000 }, 10, 30)).toBe(2_100_000);
  });

  it("suma lo programado y no proyecta lo que viene de pagos fijos", () => {
    expect(pronosticar({ ...base, real: 1_200_000, programado: 100_000 }, 10, 30)).toBe(1_300_000);
  });

  it("cuenta los pagos fijos que aún no se programan", () => {
    expect(pronosticar({ ...base, real: 0, programado: 0 }, 4, 30)).toBe(1_200_000);
  });

  it("con el mes cerrado es lo real", () => {
    expect(pronosticar({ ...base, real: 1_700_000 }, 30, 30)).toBe(1_700_000);
  });
});

describe("semaforo", () => {
  it("excedido gana sobre atento", () => {
    expect(semaforo(100, 101, 200)).toBe("excedido");
    expect(semaforo(100, 90, 120)).toBe("atento");
    expect(semaforo(100, 90, 100)).toBe("en_rango");
  });
});

describe("filasPresupuesto", () => {
  it("calcula presupuesto, diferencia y porcentaje, y omite categorías sin nada", () => {
    const filas = filasPresupuesto([{ ...base, real: 800_000 }, { ...base, id: "x", nombre: "Ropa", fijos: 0, adicional: 0 }], 15, 30);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ presupuesto: 1_600_000, diferencia: 800_000, porcentaje: 50, semaforo: "en_rango" });
  });
});

describe("armarPlan", () => {
  const regla = (extra: Partial<ReglaPlan> = {}): ReglaPlan => ({
    monto: 1_800_000, tipo: "gasto", category_id: "arriendo", frecuencia: "mensual", fecha_inicio: "2026-10-05", ocurrencias: 1, ...extra,
  });

  it("usa el equivalente mensual y cuenta lo que falta por programar en el mes", () => {
    const plan = armarPlan({
      mes: "2026-11",
      hoy: "2026-11-07",
      hasta: "2026-11-30",
      reglas: [
        regla({ fecha_inicio: "2026-11-20", ocurrencias: 0 }), // el 20: aún no se programa
        regla({ monto: 300_000, category_id: "colegio", fecha_inicio: "2026-11-01", ocurrencias: 1 }), // ya se generó
        regla({ monto: 600_000, category_id: "seguro", frecuencia: "semestral", fecha_inicio: "2026-12-01", ocurrencias: 0 }),
        regla({ monto: 5_000_000, tipo: "ingreso", category_id: "salario", fecha_inicio: "2026-11-30", ocurrencias: 0 }),
      ],
      presupuestos: [{ category_id: "mercado", monto: 900_000 }, { category_id: null, monto: 5 }],
    });
    expect(plan.categorias).toEqual([
      { category_id: "arriendo", fijos: 1_800_000, variable: 0 },
      { category_id: "colegio", fijos: 300_000, variable: 0 },
      { category_id: "seguro", fijos: 100_000, variable: 0 },
      { category_id: "mercado", fijos: 0, variable: 900_000 },
    ]);
    expect(plan.ingresosFijos).toBe(5_000_000);
    expect(plan.porProgramar).toEqual({ monto: 1_800_000, cantidad: 1 });
  });

  it("en un mes futuro cuenta todas sus ocurrencias", () => {
    const plan = armarPlan({ mes: "2026-12", hoy: "2026-11-07", hasta: "2026-12-31", reglas: [regla({ frecuencia: "quincenal", monto: 100, fecha_inicio: "2026-11-01", ocurrencias: 1 })], presupuestos: [] });
    expect(plan.porProgramar).toEqual({ monto: 300, cantidad: 3 }); // 1, 16 y 31 de diciembre
  });
});
