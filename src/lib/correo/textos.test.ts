import { describe, expect, it } from "vitest";
import { muestras } from "./muestras";
import { armarCorreo } from "./plantilla";
import { aplicarTextos, EDITABLES, reemplazar } from "./textos";

describe("textos editables de los correos automáticos", () => {
  it("reemplaza las variables conocidas y deja las desconocidas a la vista", () => {
    expect(reemplazar("Hola {nombre}, {nada}", { nombre: "Ana" })).toBe("Hola Ana, {nada}");
  });

  it("solo cambia los campos escritos y conserva tarjeta y enlaces", () => {
    const base = muestras("https://x.co").vencido.contenido;
    const c = aplicarTextos(base, { asunto: "{pago}: venció ({monto})", boton: "Ya lo pagué", titulo: "  " });
    expect(c.asunto).toBe("Arriendo: venció ($ 2.400.000)".replace("Arriendo", base.variables!.pago).replace("$ 2.400.000", base.variables!.monto));
    expect(c.titulo).toBe(base.titulo);
    expect(c.botones?.[0]).toEqual({ ...base.botones![0], texto: "Ya lo pagué" });
    expect(c.botones?.[1]).toEqual(base.botones![1]);
    expect(c.tarjeta).toEqual(base.tarjeta);
    expect(armarCorreo(c, "https://x.co").asunto).toBe(c.asunto);
  });

  it("cada correo editable tiene muestra con variables", () => {
    const m = muestras("https://x.co");
    for (const e of EDITABLES) {
      expect(m[e.muestra], e.clave).toBeDefined();
      expect(Object.keys(m[e.muestra].contenido.variables ?? {}).length, e.clave).toBeGreaterThan(0);
    }
  });
});
