import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/*
 * Pago dentro de la app contra un Wompi falso local (WOMPI_API_URL): qué llave usa cada llamada, la firma de
 * integridad y el cuerpo de la transacción. La tarjeta solo llega como token.
 */

type Pedido = { metodo: string; ruta: string; auth: string; cuerpo: Record<string, unknown> };
const pedidos: Pedido[] = [];
let servidor: Server;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    let datos = "";
    req.on("data", (c) => (datos += c));
    req.on("end", () => {
      const p: Pedido = { metodo: req.method!, ruta: req.url!, auth: req.headers.authorization ?? "", cuerpo: datos ? JSON.parse(datos) : {} };
      pedidos.push(p);
      res.setHeader("content-type", "application/json");
      if (p.ruta.startsWith("/merchants/")) {
        res.end(JSON.stringify({ data: { presigned_acceptance: { acceptance_token: "acc_1", permalink: "https://w/terminos.pdf" }, presigned_personal_data_auth: { acceptance_token: "per_1", permalink: "https://w/datos.pdf" } } }));
      } else if (p.ruta === "/payment_sources") {
        res.end(JSON.stringify({ data: { id: 3891, status: "AVAILABLE" } }));
      } else if (p.ruta === "/transactions" && p.cuerpo.reference === "MH-RECHAZO") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: { type: "INPUT_VALIDATION_ERROR", messages: { reference: ["La referencia ya fue usada"] } } }));
      } else if (p.ruta === "/transactions") {
        res.end(JSON.stringify({ data: { id: "12-1-1", status: "PENDING", reference: p.cuerpo.reference, amount_in_cents: p.cuerpo.amount_in_cents } }));
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const a = servidor.address();
  process.env.WOMPI_API_URL = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});

afterAll(() => {
  delete process.env.WOMPI_API_URL;
  servidor.close();
});

const config = { publica: "pub_test_abc", integridad: "test_integrity_x", eventos: "test_events_y", privada: "prv_test_z" };

describe("pago dentro de la app", async () => {
  const { aceptacionWompi, crearFuentePago, crearTransaccion } = await import("./servidor");

  it("lee los tokens de aceptación del comercio", async () => {
    const a = await aceptacionWompi(config);
    expect(a).toEqual({ aceptacion: "acc_1", datos: "per_1", terminos: "https://w/terminos.pdf", datosUrl: "https://w/datos.pdf" });
  });

  it("tarjeta nueva: llave pública, token y firma de integridad", async () => {
    const aceptacion = (await aceptacionWompi(config))!;
    const t = await crearTransaccion(config, { referencia: "MH-ABC", monto: 19_900, email: "a@b.co", medio: { tipo: "tarjeta", token: "tok_test_1", cuotas: 3 }, aceptacion });
    expect(t).toMatchObject({ id: "12-1-1", status: "PENDING" });
    const p = pedidos.at(-1)!;
    expect(p.auth).toBe("Bearer pub_test_abc");
    expect(p.cuerpo).toMatchObject({
      amount_in_cents: 1_990_000,
      currency: "COP",
      reference: "MH-ABC",
      acceptance_token: "acc_1",
      accept_personal_auth: "per_1",
      payment_method: { type: "CARD", token: "tok_test_1", installments: 3 },
      signature: createHash("sha256").update("MH-ABC1990000COPtest_integrity_x").digest("hex"),
    });
    expect(JSON.stringify(p.cuerpo)).not.toMatch(/4242/);
  });

  it("guardar tarjeta y cobrar con la fuente: llave privada", async () => {
    const aceptacion = (await aceptacionWompi(config))!;
    expect(await crearFuentePago(config, { token: "tok_test_1", email: "a@b.co", aceptacion })).toEqual({ id: 3891 });
    expect(pedidos.at(-1)!.auth).toBe("Bearer prv_test_z");
    await crearTransaccion(config, { referencia: "MH-ABC.2", monto: 19_900, email: "a@b.co", medio: { tipo: "fuente", fuente: 3891, cuotas: 1 }, aceptacion });
    const p = pedidos.at(-1)!;
    expect(p.auth).toBe("Bearer prv_test_z");
    expect(p.cuerpo).toMatchObject({ payment_source_id: 3891, recurrent: true, reference: "MH-ABC.2" });
  });

  it("Nequi y errores de Wompi", async () => {
    const aceptacion = (await aceptacionWompi(config))!;
    await crearTransaccion(config, { referencia: "MH-N", monto: 5_000, email: "a@b.co", medio: { tipo: "nequi", telefono: "3001234567" }, aceptacion });
    expect(pedidos.at(-1)!.cuerpo.payment_method).toEqual({ type: "NEQUI", phone_number: "3001234567" });
    const r = await crearTransaccion(config, { referencia: "MH-RECHAZO", monto: 5_000, email: "a@b.co", medio: { tipo: "nequi", telefono: "3001234567" }, aceptacion });
    expect(r).toEqual({ error: "La referencia ya fue usada" });
  });

  it("sin llave privada no guarda tarjetas", async () => {
    const aceptacion = (await aceptacionWompi(config))!;
    const sinPrivada = { ...config, privada: undefined };
    expect(await crearFuentePago(sinPrivada, { token: "tok", email: "a@b.co", aceptacion })).toHaveProperty("error");
    expect(await crearTransaccion(sinPrivada, { referencia: "X", monto: 1, email: "a", medio: { tipo: "fuente", fuente: 1, cuotas: 1 }, aceptacion })).toHaveProperty("error");
  });
});
