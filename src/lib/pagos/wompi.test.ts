import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiWompi, describirMetodo, eventoValido, firmaIntegridad, referenciaIntento, type EventoWompi } from "./wompi";
import { celularValido, errorTarjeta, formatearTarjeta, formatearVence, luhnValido, marcaDe, venceValido } from "./cliente";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("firmaIntegridad", () => {
  it("SHA256 de referencia + centavos + moneda + secreto (ejemplo de la documentación de Wompi)", () => {
    expect(firmaIntegridad("sk8-438k4-xmxm392-sn2m", 2490000, "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6")).toBe(
      sha("sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"),
    );
  });
});

describe("referencias y API", () => {
  it("el primer intento usa la referencia del cobro; los demás llevan el número", () => {
    expect(referenciaIntento("MH-ABC", 0)).toBe("MH-ABC");
    expect(referenciaIntento("MH-ABC", 1)).toBe("MH-ABC.2");
    expect(referenciaIntento("MH-ABC", 3)).toBe("MH-ABC.4");
  });

  it("llave de pruebas → sandbox", () => {
    expect(apiWompi("pub_test_abc")).toBe("https://sandbox.wompi.co/v1");
    expect(apiWompi("pub_prod_abc")).toBe("https://production.wompi.co/v1");
  });
});

describe("tarjeta (navegador)", () => {
  const hoy = new Date(2026, 10, 14);
  it("Luhn, marca y formato", () => {
    expect(luhnValido("4242 4242 4242 4242")).toBe(true);
    expect(luhnValido("4242 4242 4242 4241")).toBe(false);
    expect(marcaDe("5555")).toBe("MASTERCARD");
    expect(marcaDe("3714")).toBe("AMEX");
    expect(formatearTarjeta("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(formatearTarjeta("371449635398431")).toBe("3714 496353 98431");
    expect(formatearVence("1229")).toBe("12/29");
  });

  it("vencimiento contra el mes actual", () => {
    expect(venceValido("11/26", hoy)).toEqual({ mes: "11", anio: "26" });
    expect(venceValido("10/26", hoy)).toBeNull();
    expect(venceValido("13/27", hoy)).toBeNull();
  });

  it("errores en orden y celular de Nequi", () => {
    expect(errorTarjeta({ numero: "4242", vence: "12/29", cvc: "123", titular: "Ana Gómez" })).toMatch(/número/);
    expect(errorTarjeta({ numero: "4242424242424242", vence: "12/29", cvc: "1", titular: "Ana Gómez" })).toMatch(/seguridad/);
    expect(errorTarjeta({ numero: "4242424242424242", vence: "12/29", cvc: "123", titular: "Ana Gómez" })).toBeNull();
    expect(celularValido("300 123 4567")).toBe(true);
    expect(celularValido("6012345678")).toBe(false);
  });
});

describe("eventoValido", () => {
  const secreto = "test_events_secreto";
  const evento = (checksum?: string): EventoWompi => {
    const e: EventoWompi = {
      event: "transaction.updated",
      data: { transaction: { id: "1234-1610641025-49201", status: "APPROVED", amount_in_cents: 4490000, reference: "MH-X" } },
      signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: "" },
      timestamp: 1530291411,
    };
    e.signature.checksum = checksum ?? sha(`1234-1610641025-49201APPROVED44900001530291411${secreto}`).toUpperCase();
    return e;
  };

  it("acepta el checksum correcto (mayúsculas o minúsculas)", () => {
    expect(eventoValido(evento(), secreto)).toBe(true);
    expect(eventoValido(evento(evento().signature.checksum.toLowerCase()), secreto)).toBe(true);
  });

  it("rechaza un evento alterado o con otro secreto", () => {
    const e = evento();
    e.data.transaction!.amount_in_cents = 100;
    expect(eventoValido(e, secreto)).toBe(false);
    expect(eventoValido(evento(), "otro")).toBe(false);
    expect(eventoValido({ ...evento(), signature: { properties: [], checksum: "x" } }, secreto)).toBe(false);
  });
});

describe("describirMetodo", () => {
  it("tarjeta, Nequi y PSE", () => {
    expect(describirMetodo({ id: "1", status: "APPROVED", reference: "r", amount_in_cents: 1, payment_method_type: "CARD", payment_method: { extra: { brand: "VISA", last_four: "4242" } } })).toEqual({ metodo: "Tarjeta", detalle: "VISA ···4242" });
    expect(describirMetodo({ id: "1", status: "APPROVED", reference: "r", amount_in_cents: 1, payment_method_type: "NEQUI", payment_method: { phone_number: "3001234321" } })).toEqual({ metodo: "Nequi", detalle: "···4321" });
    expect(describirMetodo({ id: "1", status: "APPROVED", reference: "r", amount_in_cents: 1, payment_method_type: "PSE" })).toEqual({ metodo: "PSE", detalle: null });
  });
});
