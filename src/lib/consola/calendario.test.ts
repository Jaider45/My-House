import { describe, expect, it } from "vitest";
import { agruparCalendario, calendarioATexto, leerCalendario } from "./calendario";

/** 50 pares 01-02 … 99-00, un día distinto cada par desde el 1 de agosto de 2027. */
const completo = Array.from({ length: 50 }, (_, i) => {
  const a = String(2 * i + 1).padStart(2, "0");
  const b = String((2 * i + 2) % 100).padStart(2, "0");
  const dia = new Date(Date.UTC(2027, 7, 1 + i)).toISOString().slice(0, 10);
  return `${a}-${b} ${dia}`;
}).join("\n");

describe("leerCalendario", () => {
  it("lee los 50 pares y deja el 00 al final", () => {
    const r = leerCalendario(completo, 2026);
    if ("error" in r) throw new Error(r.error);
    expect(r.fechas).toHaveLength(100);
    expect(r.fechas[0]).toEqual({ d: 1, fecha: "2027-08-01" });
    expect(r.fechas[99]).toEqual({ d: 0, fecha: "2027-09-19" });
  });

  it("acepta fechas dd/mm/aaaa y rangos con «al»", () => {
    const texto = completo.replace("01-02 2027-08-01", "01 al 02: 01/08/2027");
    expect("fechas" in leerCalendario(texto, 2026)).toBe(true);
  });

  it("explica lo que falta, lo repetido y el año equivocado", () => {
    expect(leerCalendario("01-02 2027-08-12", 2026)).toEqual({ error: expect.stringMatching(/Faltan 98/) });
    expect(leerCalendario(`${completo}\n05 2027-10-01`, 2026)).toEqual({ error: "La terminación 05 está repetida." });
    expect(leerCalendario("01-02 2026-08-12", 2026)).toEqual({ error: "Línea 1: la fecha debe ser de 2027." });
    expect(leerCalendario("hola", 2026)).toEqual({ error: expect.stringMatching(/Línea 1/) });
    expect(leerCalendario("01-02 2027-02-30", 2026)).toEqual({ error: expect.stringMatching(/Línea 1/) });
  });
});

describe("agrupar y volver a texto", () => {
  it("es el inverso de leer", () => {
    const r = leerCalendario(completo, 2026);
    if ("error" in r) throw new Error(r.error);
    expect(agruparCalendario(r.fechas)).toHaveLength(50);
    expect(calendarioATexto(r.fechas)).toBe(completo);
  });
});
