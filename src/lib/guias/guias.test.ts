import { describe, expect, it } from "vitest";
import { GUIAS, coincideRuta, guiasPara, leerEnCurso, leerVistas } from ".";

describe("coincideRuta", () => {
  it("ruta exacta", () => {
    expect(coincideRuta("/cuentas", "/cuentas", "")).toBe(true);
    expect(coincideRuta("/cuentas", "/cuentas/x", "")).toBe(false);
    expect(coincideRuta("/", "/movimientos", "")).toBe(false);
  });

  it("prefijo con /*: cualquier subruta, no la raíz", () => {
    expect(coincideRuta("/movimientos/*", "/movimientos/123", "")).toBe(true);
    expect(coincideRuta("/movimientos/*", "/movimientos", "")).toBe(false);
    expect(coincideRuta("/movimientos/*", "/movimientos/", "")).toBe(false);
    expect(coincideRuta("/movimientos/*", "/movimientosx/1", "")).toBe(false);
  });

  it("los parámetros pedidos deben estar; los demás no importan", () => {
    expect(coincideRuta("/presupuesto?editar=1", "/presupuesto", "?mes=2026-11&editar=1")).toBe(true);
    expect(coincideRuta("/presupuesto?editar=1", "/presupuesto", "?mes=2026-11")).toBe(false);
    expect(coincideRuta("/presupuesto", "/presupuesto", "?editar=1")).toBe(true);
  });
});

describe("estado guardado y guías vistas", () => {
  it("lee una guía en curso válida y descarta lo dañado", () => {
    expect(leerEnCurso(JSON.stringify({ id: "cuenta", paso: 2 }))).toEqual({ id: "cuenta", paso: 2 });
    expect(leerEnCurso(null)).toBeNull();
    expect(leerEnCurso("{no es json")).toBeNull();
    expect(leerEnCurso(JSON.stringify({ id: "inventada", paso: 0 }))).toBeNull();
    expect(leerEnCurso(JSON.stringify({ id: "cuenta", paso: 99 }))).toBeNull();
    expect(leerEnCurso(JSON.stringify({ id: "cuenta", paso: 1.5 }))).toBeNull();
  });

  it("guías vistas: solo ids conocidos", () => {
    expect(leerVistas({ guias: ["bienvenida", "otra", 3] })).toEqual(["bienvenida"]);
    expect(leerVistas(undefined)).toEqual([]);
    expect(leerVistas({ guias: "bienvenida" })).toEqual([]);
  });
});

describe("guiasPara", () => {
  it("el contador solo ve las que no registran; el editor no ve invitar", () => {
    const ids = (r: "admin" | "editor" | "contador") => guiasPara(r).map((g) => g.id);
    expect(ids("contador")).toEqual(["bienvenida", "ver_movimiento", "renta", "dos_pasos"]);
    expect(ids("editor")).not.toContain("invitar");
    expect(ids("admin")).toHaveLength(GUIAS.length);
  });
});

describe("catálogo", () => {
  it("ids únicos y cada guía con pasos", () => {
    expect(new Set(GUIAS.map((g) => g.id)).size).toBe(GUIAS.length);
    for (const g of GUIAS) expect(g.pasos.length).toBeGreaterThan(1);
  });

  it("los pasos que avanzan por acción tienen qué iluminar; las rutas empiezan por /", () => {
    for (const g of GUIAS)
      for (const p of g.pasos) {
        if (p.avance === "clic" || p.avance === "envio") expect(p.objetivo, `${g.id}: ${p.titulo}`).toBeTruthy();
        if (p.ruta) expect(p.ruta.startsWith("/"), `${g.id}: ${p.ruta}`).toBe(true);
        if (p.objetivo && !g.pasos.some((x) => x.ruta)) throw new Error(`${g.id}: objetivo sin ruta`);
      }
  });

  it("tras tocar «Nueva…» los pasos del formulario van en la ventana (`?nuevo=1`)", () => {
    for (const g of GUIAS)
      g.pasos.forEach((p, i) => {
        if (p.avance === "clic" && p.objetivo?.includes("boton-flotante")) expect(g.pasos[i + 1]?.ruta, `${g.id}: ${p.titulo}`).toMatch(/\?nuevo=1$/);
      });
  });

  it("la última guía de cada flujo termina con algo que ver, no con un envío pendiente", () => {
    for (const g of GUIAS) expect(g.pasos.at(-1)?.avance ?? "siguiente", g.id).not.toBe("clic");
  });
});
