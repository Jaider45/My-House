import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { desdeEntorno, firmaWhatsappValida } = await import("./servidor");

describe("desdeEntorno", () => {
  it("toma las variables de antes solo si están las obligatorias", () => {
    expect(desdeEntorno("wompi", { WOMPI_PUBLIC_KEY: "pub_test_x", WOMPI_INTEGRITY_SECRET: "a", WOMPI_EVENTS_SECRET: "b" })).toEqual({ llave_publica: "pub_test_x", integridad: "a", eventos: "b" });
    expect(desdeEntorno("wompi", { WOMPI_PUBLIC_KEY: "pub_test_x" })).toBeNull();
    expect(desdeEntorno("resend", { RESEND_API_KEY: " re_x ", CORREO_REMITENTE: "" })).toEqual({ api_key: "re_x" });
  });
});

describe("firmaWhatsappValida", () => {
  const cuerpo = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
  it("acepta la firma de Meta y rechaza todo lo demás", () => {
    expect(firmaWhatsappValida(cuerpo, firma, "secreto")).toBe(true);
    expect(firmaWhatsappValida(cuerpo + " ", firma, "secreto")).toBe(false);
    expect(firmaWhatsappValida(cuerpo, firma, "otro")).toBe(false);
    expect(firmaWhatsappValida(cuerpo, null, "secreto")).toBe(false);
    expect(firmaWhatsappValida(cuerpo, firma, "")).toBe(false);
  });
});
