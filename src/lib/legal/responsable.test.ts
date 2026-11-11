import { describe, expect, it } from "vitest";
import { fechaVersion, VERSION_LEGAL } from "./responsable";

describe("textos legales", () => {
  it("la versión es una fecha AAAA-MM-DD (la base la exige)", () => {
    expect(VERSION_LEGAL).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("muestra la versión como fecha en español", () => {
    expect(fechaVersion("2026-11-11")).toBe("11 de noviembre de 2026");
    expect(fechaVersion("2027-01-01")).toBe("1 de enero de 2027");
  });
});
