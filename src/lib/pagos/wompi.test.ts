import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiWompi, describirMetodo, eventoValido, firmaIntegridad, urlCheckout, type EventoWompi } from "./wompi";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("firmaIntegridad", () => {
  it("SHA256 de referencia + centavos + moneda + secreto (ejemplo de la documentación de Wompi)", () => {
    expect(firmaIntegridad("sk8-438k4-xmxm392-sn2m", 2490000, "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6")).toBe(
      sha("sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"),
    );
  });
});

describe("urlCheckout", () => {
  it("monto en centavos, firma y redirección", () => {
    const u = new URL(urlCheckout({ publica: "pub_test_x", integridad: "sec", eventos: "ev" }, { referencia: "MH-1", monto: 19_900, email: "a@b.co", redireccion: "https://app/plan" }));
    expect(u.origin + u.pathname).toBe("https://checkout.wompi.co/p/");
    expect(u.searchParams.get("amount-in-cents")).toBe("1990000");
    expect(u.searchParams.get("signature:integrity")).toBe(sha("MH-11990000COPsec"));
    expect(u.searchParams.get("redirect-url")).toBe("https://app/plan");
    expect(u.searchParams.get("customer-data:email")).toBe("a@b.co");
  });

  it("llave de pruebas → sandbox", () => {
    expect(apiWompi("pub_test_abc")).toBe("https://sandbox.wompi.co/v1");
    expect(apiWompi("pub_prod_abc")).toBe("https://production.wompi.co/v1");
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
