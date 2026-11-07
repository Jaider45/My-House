import { describe, expect, it } from "vitest";
import { describirDispositivo, formatearMomento, lugarAproximado } from "./dispositivo";

const cabeceras = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });

describe("describirDispositivo", () => {
  it("reconoce navegadores y sistemas comunes", () => {
    expect(describirDispositivo("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36")).toBe("Chrome en Windows");
    expect(describirDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari en iPhone");
    expect(describirDispositivo("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36")).toBe("Chrome en Android");
    expect(describirDispositivo("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0")).toBe("Edge en Windows");
    expect(describirDispositivo("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0")).toBe("Firefox en Mac");
    expect(describirDispositivo("")).toBe("Navegador desconocido");
  });
});

describe("lugarAproximado", () => {
  it("usa las cabeceras de Vercel y nombra el país en español", () => {
    expect(lugarAproximado(cabeceras({ "x-vercel-ip-city": "Medell%C3%ADn", "x-vercel-ip-country": "CO" }))).toBe("Medellín, Colombia");
    expect(lugarAproximado(cabeceras({}))).toBeNull();
  });
});

describe("formatearMomento", () => {
  it("fecha y hora de Colombia", () => {
    expect(formatearMomento(new Date("2026-11-06T12:31:00Z"))).toBe("6 nov 2026, 7:31 a. m.");
  });
});
