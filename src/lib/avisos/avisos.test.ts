import { describe, expect, it } from "vitest";
import { plano as planoCrudo, type Texto } from "@/lib/correo/plantilla";

// formatearCOP usa espacio duro después del $ (no se parte): para comparar, espacio normal.
const plano = (t: Texto) => planoCrudo(t).replace(/ /g, " ");
const sinDuro = <T,>(x: T): T => JSON.parse(JSON.stringify(x).replace(/ /g, " "));
import { cuandoVence, planificarAvisos, type DatosHogar } from ".";

const SITIO = "https://myhouse.app";
const base = (extra: Partial<DatosHogar> = {}): DatosHogar => ({
  hogar: { id: "h", nombre: "Hogar Martínez Rojas", resumenSemanal: false },
  personas: [{ email: "andres@x.co", nombre: "Andrés" }, { email: "camila@x.co", nombre: "Camila" }],
  recordatorios: [],
  vencidos: [],
  ...extra,
});
const recordatorio = { id: "r1", nombre: "Tarjeta Visa", fecha: "2026-11-20", monto: 520000, repetir: "mensual" as const, avisos: [3, 0], canales: ["correo"], activo: true };

describe("cuandoVence", () => {
  it("hoy, mañana o la fecha", () => {
    expect(cuandoVence("2026-11-17", "2026-11-17")).toBe("Hoy");
    expect(cuandoVence("2026-11-18", "2026-11-17")).toBe("Mañana");
    expect(cuandoVence("2026-11-20", "2026-11-17")).toBe("El viernes 20 de noviembre");
  });
});

describe("recordatorios", () => {
  it("avisa en los días elegidos, a cada adulto y con su nombre", () => {
    const a = planificarAvisos(base({ recordatorios: [recordatorio] }), "2026-11-17", SITIO);
    expect(a).toHaveLength(1);
    expect(a[0].clave).toBe("recordatorio:r1:2026-11-20:3");
    expect(a[0].envios.map((e) => e.para)).toEqual(["andres@x.co", "camila@x.co"]);
    expect(plano(a[0].envios[1].contenido.asunto)).toBe("El viernes 20 de noviembre vence Tarjeta Visa: $ 520.000");
    expect(plano(a[0].envios[1].contenido.intro)).toContain("Hola Camila,");
    expect(planificarAvisos(base({ recordatorios: [recordatorio] }), "2026-11-20", SITIO)[0].clave).toBe("recordatorio:r1:2026-11-20:0");
  });

  it("los mensuales siguen el mes siguiente; nada sin el canal correo, inactivos o en otros días", () => {
    expect(planificarAvisos(base({ recordatorios: [recordatorio] }), "2026-12-17", SITIO)[0].clave).toBe("recordatorio:r1:2026-12-20:3");
    expect(planificarAvisos(base({ recordatorios: [{ ...recordatorio, canales: ["whatsapp"] }] }), "2026-11-17", SITIO)).toEqual([]);
    expect(planificarAvisos(base({ recordatorios: [{ ...recordatorio, activo: false }] }), "2026-11-17", SITIO)).toEqual([]);
    expect(planificarAvisos(base({ recordatorios: [recordatorio] }), "2026-11-18", SITIO)).toEqual([]);
    expect(planificarAvisos(base({ recordatorios: [recordatorio], personas: [] }), "2026-11-17", SITIO)).toEqual([]);
  });
});

describe("pagos vencidos", () => {
  it("solo los de ayer, con enlace para marcarlo pagado", () => {
    const vencidos = [
      { id: "t1", nombre: "Sistecredito", monto: 587000, fecha: "2026-11-17", cuenta: "Bancolombia Ahorros" },
      { id: "t2", nombre: "Gimnasio", monto: 90000, fecha: "2026-11-16", cuenta: null },
    ];
    const a = planificarAvisos(base({ vencidos }), "2026-11-18", SITIO);
    expect(a.map((x) => x.clave)).toEqual(["vencido:t1"]);
    const c = a[0].envios[0].contenido;
    expect(plano(c.asunto)).toBe("Sistecredito venció ayer: $ 587.000");
    expect(c.botones?.[0].url).toBe(`${SITIO}/movimientos/t1`);
  });
});

describe("resumen semanal", () => {
  const semana = {
    movimientos: [
      { tipo: "gasto" as const, monto: 1_200_000, fecha: "2026-11-12", categoria: "Mercado" },
      { tipo: "gasto" as const, monto: 300_000, fecha: "2026-11-15", categoria: "Restaurantes" },
      { tipo: "ingreso" as const, monto: 700_000, fecha: "2026-11-14", categoria: null },
      { tipo: "gasto" as const, monto: 1_000_000, fecha: "2026-11-05", categoria: "Mercado" },
    ],
    proximos: [{ nombre: "Tarjeta Visa", monto: 520000, fecha: "2026-11-20" }, { nombre: "Arriendo", monto: 2_000_000, fecha: "2026-12-01" }],
  };
  it("los lunes, si el hogar lo activó: semana pasada, comparación y lo que vence", () => {
    const a = planificarAvisos(base({ hogar: { id: "h", nombre: "Hogar", resumenSemanal: true }, semana }), "2026-11-16", SITIO);
    expect(a).toHaveLength(1);
    const c = a[0].envios[0].contenido;
    expect(plano(c.asunto)).toBe("Tu semana en la casa: $ 1.500.000 en gastos");
    expect(plano(c.intro)).toBe("Hola Andrés. Del lunes 9 al domingo 15 de noviembre.");
    expect(sinDuro(c.cifras?.map((x) => x.v))).toEqual(["$ 1.500.000", "$ 700.000", "Mercado", "+50 %"]);
    expect(plano(c.nota!.texto)).toContain("50 % más");
    expect(sinDuro(c.lista?.items)).toEqual([{ n: "20", t: "Tarjeta Visa · $ 520.000", d: "Viernes" }]);
  });
  it("no sale otro día ni si el hogar no lo activó", () => {
    expect(planificarAvisos(base({ hogar: { id: "h", nombre: "Hogar", resumenSemanal: true }, semana }), "2026-11-17", SITIO)).toEqual([]);
    expect(planificarAvisos(base({ semana }), "2026-11-16", SITIO)).toEqual([]);
  });
});

describe("Renta DIAN", () => {
  const tope = (nombre: string, porcentaje: number) => ({
    clave: nombre, nombre, ayuda: "", acumulado: 84_150_000, tope: 73_323_600, topeUnidades: 1400, porcentaje, semaforo: (porcentaje >= 100 ? "rojo" : porcentaje >= 70 ? "amarillo" : "verde") as "rojo" | "amarillo" | "verde",
  });
  it("una vez por persona y año cuando alcanza un tope, mencionando los cercanos", () => {
    const dian = { anio: 2026, personas: [{ member_id: "m1", nombre: "Andrés", topes: [tope("Ingresos brutos", 114), tope("Compras y consumos", 91), tope("Consignaciones", 40)] }, { member_id: "m2", nombre: "Camila", topes: [tope("Ingresos brutos", 60)] }] };
    const a = planificarAvisos(base({ dian }), "2026-11-17", SITIO);
    expect(a.map((x) => x.clave)).toEqual(["dian:2026:m1"]);
    const c = a[0].envios[0].contenido;
    expect(plano(c.asunto)).toBe("Andrés deberá declarar renta en 2027");
    expect(plano(c.nota!.texto)).toContain("compras y consumos (91 %)");
    expect(plano(c.nota!.texto)).not.toContain("consignaciones");
  });
});
