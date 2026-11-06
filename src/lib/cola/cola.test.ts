import { describe, expect, it } from "vitest";
import { CLAVE_COLA, camposDe, encolar, esErrorDeRed, leerCola, marcarError, nuevaClave, porEnviar, quitarDeCola } from ".";

function memoria() {
  const datos = new Map<string, string>();
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
}

describe("cola de registros sin conexión", () => {
  it("encola, marca rechazados y quita los enviados", () => {
    const m = memoria();
    expect(encolar(m, { tipo: "gasto", monto: "25000" })).toBe(true);
    expect(encolar(m, { tipo: "gasto", monto: "8000" })).toBe(true);
    const [a, b] = leerCola(m);
    expect(a.campos.monto).toBe("25000");
    expect(a.id).not.toBe(b.id);

    marcarError(m, a.id, "La categoría ya no existe.");
    expect(porEnviar(leerCola(m)).map((p) => p.id)).toEqual([b.id]);
    quitarDeCola(m, b.id);
    expect(leerCola(m)).toHaveLength(1);
    expect(leerCola(m)[0].error).toBe("La categoría ya no existe.");
  });

  it("no pasa de 50 y tolera datos dañados", () => {
    const m = memoria();
    for (let i = 0; i < 50; i++) encolar(m, { monto: String(i) });
    expect(encolar(m, { monto: "51" })).toBe(false);
    expect(leerCola(m)).toHaveLength(50);
    m.setItem(CLAVE_COLA, "{no es json");
    expect(leerCola(m)).toEqual([]);
    m.setItem(CLAVE_COLA, JSON.stringify([{ id: 1 }, null, { id: "x", campos: {} }]));
    expect(leerCola(m)).toHaveLength(1);
  });

  it("copia solo los campos de texto del formulario", () => {
    const d = new FormData();
    d.set("monto", "1000");
    d.set("foto", new Blob(["x"]), "f.jpg");
    expect(camposDe(d)).toEqual({ monto: "1000" });
  });

  it("distingue errores de red de respuestas del servidor", () => {
    expect(esErrorDeRed(new TypeError("Failed to fetch"))).toBe(true);
    expect(esErrorDeRed(new Error("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(esErrorDeRed(new Error("Tu rol es de solo lectura."))).toBe(false);
  });
});

describe("nuevaClave", () => {
  it("arma un UUID v4 válido y distinto cada vez", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = nuevaClave();
    expect(a).toMatch(uuid);
    expect(nuevaClave()).not.toBe(a);
    expect(nuevaClave((b) => b.fill(255))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("la clave viaja en la cola con el registro", () => {
    const m = memoria();
    encolar(m, { monto: "25000", clave: "c1" });
    expect(leerCola(m)[0].campos.clave).toBe("c1");
  });
});
