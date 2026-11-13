import { describe, expect, it } from "vitest";
import { celda, csvReporte, estadoSoportes } from "./reporte";

describe("reporte de renta", () => {
  it("celdas seguras: comillas y sin fórmulas", () => {
    expect(celda('Droguería "La 14"; centro')).toBe('"Droguería ""La 14""; centro"');
    expect(celda("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(celda(1234)).toBe("1234");
    expect(celda(null)).toBe("");
  });

  it("estado de soportes por etiqueta", () => {
    expect(estadoSoportes({ movimientos: 3, conSoporte: 3 })).toEqual({ texto: "Completo", tono: "ok" });
    expect(estadoSoportes({ movimientos: 3, conSoporte: 1 })).toEqual({ texto: "Faltan 2", tono: "alerta" });
    expect(estadoSoportes({ movimientos: 2, conSoporte: 0 }).tono).toBe("error");
  });

  it("CSV con BOM, secciones y punto y coma", () => {
    const csv = csvReporte({
      hogar: "Hogar Martínez",
      anio: 2026,
      generado: "2026-11-14",
      unidad: "UVT",
      valorUnidad: 52_374,
      topes: [{ persona: "Andrés", tope: "Ingresos brutos", acumulado: 84_150_000, topePesos: 73_323_600, porcentaje: 114, estado: "rojo" }],
      etiquetas: [{ etiqueta: "Medicina prepagada", movimientos: 2, total: 1_200_000, conSoporte: 1 }],
      movimientos: [{ fecha: "2026-03-01", persona: "Andrés", concepto: "Colsanitas", etiqueta: "Medicina prepagada", tipo: "gasto", monto: 600_000, soporte: true }],
    });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Andrés;Ingresos brutos;84150000;73323600;114;Obligado");
    expect(csv).toContain("Medicina prepagada;2;1200000;1;Faltan 1");
    expect(csv).toContain("2026-03-01;Andrés;Colsanitas;Medicina prepagada;gasto;600000;Sí");
  });
});
