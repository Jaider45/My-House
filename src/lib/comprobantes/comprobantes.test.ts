import { describe, expect, it } from "vitest";
import { decidir, patronDe, reglaPara, type Lectura, type ReglaComercio } from ".";

const opciones = {
  categorias: [
    { id: "c-mercado", nombre: "Mercado" },
    { id: "c-mascotas", nombre: "Mascotas" },
    { id: "c-salud", nombre: "Salud" },
  ],
  cuentas: [
    { id: "a-visa", nombre: "Visa Bancolombia" },
    { id: "a-nequi", nombre: "Nequi" },
  ],
  etiquetas: [{ id: "t-med", nombre: "Medicina prepagada" }],
  reglas: [] as ReglaComercio[],
  hoy: "2026-11-05",
  cuentaPorDefecto: "a-nequi",
};

const lectura: Lectura = {
  es_comprobante: true,
  tipo: "gasto",
  comercio: "Éxito Calle 80",
  fecha: "2026-11-04",
  total: 286_400,
  categoria: "mercado",
  confianza: 95,
  cuenta: "visa bancolombia",
  etiqueta_dian: null,
  ambito: null,
  pregunta: null,
};

describe("decidir", () => {
  it("registra cuando todo se leyó con confianza, y empareja nombres sin importar mayúsculas", () => {
    expect(decidir(lectura, opciones)).toMatchObject({
      accion: "registrar",
      monto: 286_400,
      fecha: "2026-11-04",
      category_id: "c-mercado",
      account_id: "a-visa",
      ambito: "personal",
      porRegla: false,
    });
  });

  it("pide revisión si falta el total, la fecha o la categoría", () => {
    expect(decidir({ ...lectura, total: null }, opciones)).toMatchObject({ accion: "revisar", pregunta: "¿Cuánto fue el total?" });
    expect(decidir({ ...lectura, fecha: "2026-12-01" }, opciones)).toMatchObject({ accion: "revisar", pregunta: "¿De qué fecha es?" });
    expect(decidir({ ...lectura, categoria: "Ferretería" }, opciones)).toMatchObject({ accion: "revisar", category_id: null });
  });

  it("con baja confianza pregunta, salvo que una regla aprendida resuelva la categoría", () => {
    expect(decidir({ ...lectura, confianza: 40, pregunta: "¿Es Éxito o Carulla?" }, opciones)).toMatchObject({ accion: "revisar", pregunta: "¿Es Éxito o Carulla?" });
    const reglas = [{ patron: "exito", category_id: "c-mercado", ambito: null, activa: true }];
    expect(decidir({ ...lectura, confianza: 40, categoria: null }, { ...opciones, reglas })).toMatchObject({ accion: "registrar", porRegla: true });
  });

  it("descarta lo que no es un comprobante y usa la cuenta por defecto si no se ve el medio de pago", () => {
    expect(decidir({ ...lectura, es_comprobante: false }, opciones).accion).toBe("descartar");
    expect(decidir({ ...lectura, cuenta: null }, opciones)).toMatchObject({ account_id: "a-nequi" });
  });
});

describe("reglas de comercio", () => {
  const reglas: ReglaComercio[] = [
    { patron: "veterinaria", category_id: "c-salud", ambito: null, activa: true },
    { patron: "veterinaria patitas", category_id: "c-mascotas", ambito: "personal", activa: true },
    { patron: "exito", category_id: "c-mercado", ambito: null, activa: false },
  ];

  it("gana el patrón más específico y se ignoran las reglas apagadas", () => {
    expect(reglaPara("Transferencia a Veterinaria Patitas", reglas)?.category_id).toBe("c-mascotas");
    expect(reglaPara("Éxito Calle 80", reglas)).toBeUndefined();
  });

  it("el patrón aprendido son las dos primeras palabras significativas", () => {
    expect(patronDe("Veterinaria Patitas S.A.S. #123")).toBe("veterinaria patitas");
    expect(patronDe("D1 Tienda 455")).toBe("tienda");
  });
});
