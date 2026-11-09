import { describe, expect, it } from "vitest";
import { idDe } from "./acciones";

describe("idDe", () => {
  const datos = (v: string | Blob) => {
    const f = new FormData();
    f.append("id", v);
    return f;
  };

  it("devuelve el id solo si es un UUID", () => {
    expect(idDe(datos("0b9c6c2e-4f7a-4d8e-9a51-3f1e2d4c5b6a"))).toBe("0b9c6c2e-4f7a-4d8e-9a51-3f1e2d4c5b6a");
    expect(idDe(datos("1"))).toBeNull();
    expect(idDe(datos("0b9c6c2e-4f7a-4d8e-9a51-3f1e2d4c5b6a,id.neq.x"))).toBeNull();
    expect(idDe(datos(new Blob(["x"])))).toBeNull();
    expect(idDe(new FormData())).toBeNull();
  });

  it("lee otro campo si se pide", () => {
    const f = new FormData();
    f.append("regla", "0b9c6c2e-4f7a-4d8e-9a51-3f1e2d4c5b6a");
    expect(idDe(f, "regla")).toBe("0b9c6c2e-4f7a-4d8e-9a51-3f1e2d4c5b6a");
  });
});
