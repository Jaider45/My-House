import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { estadoDeEvento, estadoQueQueda, firmaSvixValida } from "./eventos";

const secreto = "whsec_" + Buffer.from("clave-de-prueba-svix").toString("base64");
const ahora = new Date("2026-11-10T12:00:00Z");
const ts = String(Math.floor(ahora.getTime() / 1000));

function firmar(cuerpo: string, id = "msg_1", timestamp = ts) {
  const llave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  return "v1," + createHmac("sha256", llave).update(`${id}.${timestamp}.${cuerpo}`).digest("base64");
}

describe("firmaSvixValida", () => {
  const cuerpo = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });

  it("acepta la firma de Resend, también entre varias", () => {
    expect(firmaSvixValida(cuerpo, { id: "msg_1", timestamp: ts, firma: firmar(cuerpo) }, secreto, ahora)).toBe(true);
    expect(firmaSvixValida(cuerpo, { id: "msg_1", timestamp: ts, firma: `v1,otra ${firmar(cuerpo)}` }, secreto, ahora)).toBe(true);
  });

  it("rechaza cuerpo alterado, otro secreto, cabeceras faltantes o timestamp viejo", () => {
    expect(firmaSvixValida(cuerpo + " ", { id: "msg_1", timestamp: ts, firma: firmar(cuerpo) }, secreto, ahora)).toBe(false);
    expect(firmaSvixValida(cuerpo, { id: "msg_1", timestamp: ts, firma: firmar(cuerpo) }, "whsec_b3Rybw==", ahora)).toBe(false);
    expect(firmaSvixValida(cuerpo, { id: null, timestamp: ts, firma: firmar(cuerpo) }, secreto, ahora)).toBe(false);
    const viejo = String(Math.floor(ahora.getTime() / 1000) - 600);
    expect(firmaSvixValida(cuerpo, { id: "msg_1", timestamp: viejo, firma: firmar(cuerpo, "msg_1", viejo) }, secreto, ahora)).toBe(false);
  });
});

describe("estados", () => {
  it("mapea los eventos de Resend", () => {
    expect(estadoDeEvento("email.delivered")).toBe("entregado");
    expect(estadoDeEvento("email.clicked")).toBe("clic");
    expect(estadoDeEvento("email.delivery_delayed")).toBeNull();
  });

  it("solo avanza, y el rebote queda", () => {
    expect(estadoQueQueda("enviado", "entregado")).toBe("entregado");
    expect(estadoQueQueda("abierto", "entregado")).toBeNull();
    expect(estadoQueQueda("clic", "rebotado")).toBe("rebotado");
    expect(estadoQueQueda("rebotado", "abierto")).toBeNull();
  });
});
