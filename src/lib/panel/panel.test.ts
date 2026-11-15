import { describe, expect, it } from "vitest";
import { datosNecesarios, leerPanel, normalizarPanel, panelDePlantilla, PLANTILLAS, MAX_INDICADORES, INDICADORES } from ".";

describe("leerPanel", () => {
  it("sin nada guardado es el Resumen general", () => {
    expect(leerPanel({})).toEqual(panelDePlantilla("general"));
    expect(leerPanel(null)).toEqual(panelDePlantilla("general"));
  });

  it("descarta ids que no existen y repetidos", () => {
    expect(leerPanel({ panel: { plantilla: "otra", indicadores: ["gastos", "x", "gastos"], secciones: ["deudas", 3] } })).toEqual({
      plantilla: "propio",
      indicadores: ["gastos"],
      secciones: ["deudas"],
    });
  });
});

describe("normalizarPanel", () => {
  it("conserva la plantilla solo si no se cambió", () => {
    const d = PLANTILLAS.deudas;
    expect(normalizarPanel({ plantilla: "deudas", indicadores: d.indicadores, secciones: d.secciones })?.plantilla).toBe("deudas");
    expect(normalizarPanel({ plantilla: "deudas", indicadores: d.indicadores.slice(1), secciones: d.secciones })?.plantilla).toBe("propio");
  });

  it("un panel vacío no se guarda y los indicadores tienen tope", () => {
    expect(normalizarPanel({ indicadores: [], secciones: [] })).toBeNull();
    expect(normalizarPanel({ indicadores: Object.keys(INDICADORES), secciones: [] })?.indicadores).toHaveLength(MAX_INDICADORES);
  });
});

describe("plantillas", () => {
  it("cada plantilla trae entre 4 y el máximo de indicadores y al menos una sección", () => {
    for (const p of Object.values(PLANTILLAS)) {
      expect(p.indicadores.length).toBeGreaterThanOrEqual(4);
      expect(p.indicadores.length).toBeLessThanOrEqual(MAX_INDICADORES);
      expect(p.secciones.length).toBeGreaterThan(0);
    }
  });

  it("solo pide a la base lo que el panel muestra", () => {
    expect(datosNecesarios(panelDePlantilla("general"))).toEqual({ deudas: false, metas: false, saldos: false, semaforo: true });
    expect(datosNecesarios(panelDePlantilla("deudas"))).toMatchObject({ deudas: true, saldos: true });
  });
});
