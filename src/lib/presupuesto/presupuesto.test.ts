import { describe, expect, it } from "vitest";
import { filasPresupuesto, pronosticar, semaforo, type EntradaCategoria } from ".";

const base: EntradaCategoria = { id: "m", nombre: "Mercado", fijos: 1_200_000, adicional: 400_000, real: 0, programado: 0, promedio3: 1_500_000 };

describe("pronosticar", () => {
  it("proyecta el ritmo del gasto variable en los días que faltan", () => {
    // Variable 300.000 en 10 días → 30.000 por día × 20 días restantes = 600.000.
    expect(pronosticar({ ...base, real: 1_500_000 }, 10, 30)).toBe(2_100_000);
  });

  it("suma lo programado y no proyecta lo que viene de pagos fijos", () => {
    expect(pronosticar({ ...base, real: 1_200_000, programado: 100_000 }, 10, 30)).toBe(1_300_000);
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
