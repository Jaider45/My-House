import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/integraciones/servidor", () => ({ leerIntegracion: vi.fn(), probar: vi.fn() }));
vi.mock("@/lib/supabase/servicio", () => ({ hayServicio: () => false, crearClienteServicio: vi.fn() }));

const { esComponente, resendResponde, chequear } = await import(".");

describe("salud", () => {
  it("reconoce solo los componentes conocidos", () => {
    expect(esComponente("base")).toBe(true);
    expect(esComponente("ia")).toBe(true);
    expect(esComponente("movimientos")).toBe(false);
    expect(esComponente("__proto__")).toBe(false);
  });

  it("Resend: la llave de solo envío cuenta como operativa; una llave mala no", () => {
    expect(resendResponde(200, {})).toBe(true);
    expect(resendResponde(401, { name: "restricted_api_key" })).toBe(true);
    expect(resendResponde(401, { name: "invalid_api_key" })).toBe(false);
    expect(resendResponde(403, { name: "restricted_api_key" })).toBe(false);
    expect(resendResponde(500, {})).toBe(false);
  });

  it("sin llave service_role la base se reporta como falla, sin lanzar", async () => {
    await expect(chequear("base")).resolves.toMatchObject({ ok: false });
    await expect(chequear("app")).resolves.toEqual({ ok: true });
  });
});
