import { describe, expect, it } from "vitest";
import { clasificar, detectarEncabezado, formatoPara, huellas, leerFilas, normalizarDescripcion, sugerirMapeo, type Existente, type Mapeo } from ".";

const CUENTA = "cuenta-1";
const unico: Mapeo = { fecha: "Fecha", descripcion: "Descripción", modo: "unico", monto: "Valor", gastosNegativos: true };

describe("normalizarDescripcion", () => {
  it("quita tildes, signos y espacios de más", () => {
    expect(normalizarDescripcion("  PAGO PSE  Éxito*123 ")).toBe("pago pse exito 123");
    expect(normalizarDescripcion("Compra en NIÑOS & Cía.")).toBe("compra en ninos cia");
  });
});

describe("leerFilas", () => {
  it("lee montos con signo: negativos son gastos", () => {
    const { validas, errores } = leerFilas(
      [
        { Fecha: "01/08/2026", Descripción: "Nómina", Valor: "4.500.000,00" },
        { Fecha: "02/08/2026", Descripción: "Éxito", Valor: "-185.400" },
        { Fecha: "", Descripción: "", Valor: "" },
      ],
      unico,
    );
    expect(errores).toEqual([]);
    expect(validas).toEqual([
      { fila: 1, fecha: "2026-08-01", monto: 4_500_000, tipo: "ingreso", descripcion: "Nómina" },
      { fila: 2, fecha: "2026-08-02", monto: 185_400, tipo: "gasto", descripcion: "Éxito" },
    ]);
  });

  it("acepta extractos con gastos en positivo", () => {
    const { validas } = leerFilas([{ Fecha: "2026-08-02", Descripción: "Éxito", Valor: "185400" }], { ...unico, gastosNegativos: false });
    expect(validas[0].tipo).toBe("gasto");
  });

  it("lee columnas separadas de débito y crédito", () => {
    const mapeo: Mapeo = { fecha: "F", descripcion: "D", modo: "separado", debito: "Débito", credito: "Crédito", gastosNegativos: true };
    const { validas } = leerFilas(
      [
        { F: "03/08/2026", D: "Gasolina", Débito: "120.000", Crédito: "" },
        { F: "04/08/2026", D: "Transferencia", Débito: "", Crédito: "50.000" },
      ],
      mapeo,
    );
    expect(validas.map((v) => [v.tipo, v.monto])).toEqual([["gasto", 120_000], ["ingreso", 50_000]]);
  });

  it("reporta filas con fecha o monto inválidos sin detener la importación", () => {
    const { validas, errores } = leerFilas(
      [
        { Fecha: "31/02/2026", Descripción: "x", Valor: "-1" },
        { Fecha: "01/08/2026", Descripción: "x", Valor: "0" },
        { Fecha: "01/08/2026", Descripción: "ok", Valor: "-1000" },
      ],
      unico,
    );
    expect(errores.map((e) => e.fila)).toEqual([1, 2]);
    expect(validas).toHaveLength(1);
  });
});

/** Extracto sintético: cada día del rango, una compra; los días 15, dos compras idénticas. */
function extracto(desde: string, hasta: string) {
  const filas: Record<string, string>[] = [];
  for (let d = new Date(`${desde}T00:00:00Z`); d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const [a, m, dia] = iso.split("-");
    const fecha = `${dia}/${m}/${a}`;
    filas.push({ Fecha: fecha, Descripción: `Compra ${dia}`, Valor: `-${Number(dia) * 1000}` });
    if (dia === "15") filas.push({ Fecha: fecha, Descripción: "Tienda D1", Valor: "-12.900" });
    if (dia === "15") filas.push({ Fecha: fecha, Descripción: "TIENDA  D1", Valor: "-12.900" });
  }
  return filas;
}

async function importar(filas: Record<string, string>[], existentes: Existente[]) {
  const { validas } = leerFilas(filas, unico);
  const hashes = await huellas(CUENTA, validas);
  const estados = clasificar(validas, hashes, existentes);
  const nuevas: Existente[] = validas
    .filter((_, i) => estados[i] === "nuevo")
    .map((v) => ({ fecha: v.fecha, monto: v.monto, tipo: v.tipo, import_hash: hashes[validas.indexOf(v)], origen: "importacion" }));
  return { validas, estados, nuevas };
}

describe("duplicados de importación", () => {
  it("un extracto de 3 meses entra completo, incluidas dos compras idénticas el mismo día", async () => {
    const { validas, estados } = await importar(extracto("2026-08-01", "2026-10-31"), []);
    expect(validas).toHaveLength(92 + 3 * 2);
    expect(estados.every((e) => e === "nuevo")).toBe(true);
  });

  it("reimportar el mismo archivo no crea nada", async () => {
    const primero = await importar(extracto("2026-08-01", "2026-10-31"), []);
    const segundo = await importar(extracto("2026-08-01", "2026-10-31"), primero.nuevas);
    expect(segundo.estados.every((e) => e === "duplicado")).toBe(true);
  });

  it("un extracto solapado solo trae los días nuevos", async () => {
    const primero = await importar(extracto("2026-08-01", "2026-10-31"), []);
    const segundo = await importar(extracto("2026-10-01", "2026-11-30"), primero.nuevas);
    const nuevos = segundo.validas.filter((_, i) => segundo.estados[i] === "nuevo");
    expect(nuevos.every((v) => v.fecha >= "2026-11-01")).toBe(true);
    expect(nuevos).toHaveLength(30 + 2);
    expect(segundo.estados.filter((e) => e === "duplicado")).toHaveLength(31 + 2);
  });

  it("si el banco agrega una tercera compra idéntica, solo esa es nueva", async () => {
    const dia = [
      { Fecha: "15/08/2026", Descripción: "Tienda D1", Valor: "-12.900" },
      { Fecha: "15/08/2026", Descripción: "Tienda D1", Valor: "-12.900" },
    ];
    const primero = await importar(dia, []);
    const segundo = await importar([...dia, dia[0]], primero.nuevas);
    expect(segundo.estados).toEqual(["duplicado", "duplicado", "nuevo"]);
  });

  it("marca como posible duplicado un registro manual de igual monto a ±2 días, una sola vez", async () => {
    const manual: Existente[] = [{ fecha: "2026-08-14", monto: 12_900, tipo: "gasto", import_hash: null, origen: "manual" }];
    const { estados } = await importar(
      [
        { Fecha: "15/08/2026", Descripción: "Tienda D1", Valor: "-12.900" },
        { Fecha: "16/08/2026", Descripción: "Tienda D1", Valor: "-12.900" },
        { Fecha: "20/08/2026", Descripción: "Otra", Valor: "-12.900" },
      ],
      manual,
    );
    expect(estados).toEqual(["posible", "nuevo", "nuevo"]);
  });

  it("la huella depende de la cuenta", async () => {
    const { validas } = leerFilas([{ Fecha: "01/08/2026", Descripción: "x", Valor: "-1" }], unico);
    const [a] = await huellas("cuenta-a", validas);
    const [b] = await huellas("cuenta-b", validas);
    expect(a).not.toBe(b);
  });
});

describe("sugerirMapeo", () => {
  it("reconoce columnas típicas", () => {
    expect(sugerirMapeo(["FECHA", "DESCRIPCIÓN", "VALOR", "SALDO"])).toMatchObject({ fecha: "FECHA", descripcion: "DESCRIPCIÓN", modo: "unico", monto: "VALOR" });
    expect(sugerirMapeo(["Fecha", "Concepto", "Débitos", "Créditos"])).toMatchObject({ modo: "separado", debito: "Débitos", credito: "Créditos" });
  });
});

describe("detectarEncabezado", () => {
  it("salta el preámbulo del banco", () => {
    expect(detectarEncabezado([["BANCO S.A.", "", ""], ["Cuenta ****1234", "", ""], ["FECHA", "DESCRIPCIÓN", "VALOR"], ["01/08/2026", "x", "1"]])).toBe(2);
    expect(detectarEncabezado([["Fecha", "Concepto", "Valor"]])).toBe(0);
    expect(detectarEncabezado([["a", "b", "c"]])).toBe(0);
  });
});

describe("formatoPara", () => {
  const formatos = [
    { banco: "Genérico", encabezados: ["Fecha", "Valor"], mapeo: { fecha: "Fecha", descripcion: "Fecha", modo: "unico" as const, monto: "Valor", gastosNegativos: true } },
    {
      banco: "Banco X",
      encabezados: ["FECHA", "DESCRIPCIÓN", "DÉBITO", "CRÉDITO"],
      mapeo: { fecha: "FECHA", descripcion: "DESCRIPCIÓN", modo: "separado" as const, debito: "DÉBITO", credito: "CRÉDITO", gastosNegativos: true },
    },
  ];
  it("elige el más específico y usa los nombres de columna del archivo", () => {
    const r = formatoPara(["Fecha", "Descripcion", "Debito", "Credito", "Saldo"], formatos);
    expect(r?.banco).toBe("Banco X");
    expect(r?.mapeo).toMatchObject({ fecha: "Fecha", descripcion: "Descripcion", debito: "Debito", credito: "Credito", modo: "separado" });
  });
  it("sin formato que calce, nada", () => {
    expect(formatoPara(["Date", "Amount"], formatos)).toBeUndefined();
  });
});
