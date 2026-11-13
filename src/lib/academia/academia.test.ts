import { describe, expect, it } from "vitest";
import { CURSOS, avanceCurso, buscar, claveLeccion, continuar, leccionDe, leerVistasAcademia } from ".";
import { guiaPorId } from "@/lib/guias";

describe("catálogo de la Academia", () => {
  it("cursos y lecciones con slugs únicos, minutos y contenido", () => {
    expect(new Set(CURSOS.map((c) => c.slug)).size).toBe(CURSOS.length);
    for (const c of CURSOS) {
      expect(c.lecciones.length, c.slug).toBeGreaterThan(1);
      expect(new Set(c.lecciones.map((l) => l.slug)).size, c.slug).toBe(c.lecciones.length);
      for (const l of c.lecciones) {
        expect(l.minutos, l.slug).toBeGreaterThan(0);
        expect(l.bloques.some((b) => "p" in b), l.slug).toBe(true);
      }
    }
  });

  it("las guías y repasos que citan las lecciones existen y son coherentes", () => {
    for (const c of CURSOS)
      for (const l of c.lecciones)
        for (const b of l.bloques) {
          if ("guia" in b) expect(guiaPorId(b.guia.id), `${c.slug}/${l.slug}`).toBeDefined();
          if ("quiz" in b) expect(b.quiz.opciones[b.quiz.correcta], `${c.slug}/${l.slug}`).toBeDefined();
          if ("aplica" in b) expect(b.aplica.href.startsWith("/"), `${c.slug}/${l.slug}`).toBe(true);
        }
  });

  it("los enlaces de las pantallas apuntan a lecciones que existen", () => {
    for (const [curso, leccion] of [
      ["deudas", "bola-de-nieve-o-avalancha"],
      ["empieza", "pagos-fijos"],
      ["empieza", "registrar"],
      ["finanzas", "presupuesto-que-se-cumple"],
      ["finanzas", "numero-minimo"],
      ["finanzas", "cuando-te-pasas"],
      ["ahorro", "cuanto-fondo"],
      ["renta", "soportes"],
    ])
      expect(leccionDe(curso, leccion), `${curso}/${leccion}`).not.toBeNull();
  });
});

describe("avance", () => {
  const pareja = CURSOS.find((c) => c.slug === "pareja")!;

  it("lee solo claves que existen", () => {
    expect(leerVistasAcademia({ academia: ["pareja/como-repartir", "inventado/x", 3] })).toEqual(["pareja/como-repartir"]);
    expect(leerVistasAcademia(null)).toEqual([]);
  });

  it("cuenta lecciones hechas, minutos que faltan y la siguiente", () => {
    const vistas = new Set([claveLeccion("pareja", pareja.lecciones[0].slug)]);
    const a = avanceCurso(pareja, vistas);
    expect(a.hechas).toBe(1);
    expect(a.siguiente?.slug).toBe(pareja.lecciones[1].slug);
    expect(a.faltanMinutos).toBe(pareja.lecciones.slice(1).reduce((s, l) => s + l.minutos, 0));
    expect(continuar(vistas)?.curso.slug).toBe("pareja");
    expect(continuar(new Set())).toBeNull();
  });

  it("anterior y siguiente dentro del curso", () => {
    const l = leccionDe("pareja", pareja.lecciones[1].slug)!;
    expect(l.anterior?.slug).toBe(pareja.lecciones[0].slug);
    expect(l.siguiente?.slug).toBe(pareja.lecciones[2]?.slug);
    expect(leccionDe("pareja", "no-existe")).toBeNull();
  });

  it("busca sin tildes ni mayúsculas", () => {
    expect(buscar("EMERGENCIA").some((r) => r.leccion.slug === "cuanto-fondo")).toBe(true);
    expect(buscar("x")).toEqual([]);
  });
});
