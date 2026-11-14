import { describe, expect, it } from "vitest";
import { ipPermitida, reglaValida } from "./ips";

describe("IP permitidas de la consola", () => {
  it("valida reglas IPv4 (con máscara) e IPv6", () => {
    expect(reglaValida("190.85.10.0/24")).toBe(true);
    expect(reglaValida("190.85.10.7")).toBe(true);
    expect(reglaValida("2800:e2:1::5")).toBe(true);
    expect(reglaValida("300.1.1.1")).toBe(false);
    expect(reglaValida("1.2.3.4/40")).toBe(false);
    expect(reglaValida("hola")).toBe(false);
  });
  it("compara con la máscara y exacto en IPv6", () => {
    expect(ipPermitida("190.85.10.77", ["190.85.10.0/24"])).toBe(true);
    expect(ipPermitida("190.85.11.77", ["190.85.10.0/24"])).toBe(false);
    expect(ipPermitida("::ffff:190.85.10.77", ["190.85.10.77"])).toBe(true);
    expect(ipPermitida("2800:e2:1::5", ["2800:E2:1::5"])).toBe(true);
    expect(ipPermitida("8.8.8.8", [])).toBe(true);
  });
});
