import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Los adaptadores se prueban con los SDK reales contra un servidor local que imita las API de OpenAI y Anthropic:
 * se verifica lo que se envía (archivo, esquema estricto, sin guardar en OpenAI) y que la respuesta se valide con Zod.
 */

type Peticion = { url: string; cuerpo: Record<string, unknown>; cabeceras: IncomingMessage["headers"] };
const peticiones: Peticion[] = [];
let responder: (p: Peticion) => { estado?: number; json?: unknown; sse?: string } = () => ({ estado: 500 });
let servidor: Server;

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    let texto = "";
    for await (const trozo of req) texto += trozo;
    const p = { url: req.url ?? "", cuerpo: texto ? JSON.parse(texto) : {}, cabeceras: req.headers };
    peticiones.push(p);
    const r = responder(p);
    if (r.sse) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(r.sse);
    } else {
      res.writeHead(r.estado ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify(r.json ?? { error: { message: "fallo" } }));
    }
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const { port } = servidor.address() as AddressInfo;
  process.env.OPENAI_API_KEY = "sk-prueba";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.ANTHROPIC_API_KEY = "sk-ant-prueba";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
});
afterAll(() => servidor.close());
beforeEach(() => {
  peticiones.length = 0;
});

const lectura = {
  es_comprobante: true,
  tipo: "gasto",
  comercio: "Éxito Calle 80",
  fecha: "2026-11-04",
  total: 286400,
  categoria: "Mercado",
  confianza: 92,
  cuenta: null,
  etiqueta_dian: null,
  ambito: null,
  pregunta: null,
};
const contexto = { hoy: "2026-11-05", categorias: ["Mercado"], cuentas: ["Bancolombia"], etiquetas: ["Dependientes"], hogar: "Personas del hogar:\n- Sofía: persona a cargo" };
const foto = { mime: "image/jpeg", base64: "AAAA", nombre: "recibo.jpg" };
const pdf = { mime: "application/pdf", base64: "JVBERi0=", nombre: "extracto.pdf" };

const respuestaOpenAI = (texto: string, extra: Record<string, unknown> = {}) => ({
  id: "resp_1",
  object: "response",
  created_at: 0,
  model: "gpt-4.1",
  status: "completed",
  output: [{ type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text: texto, annotations: [] }] }],
  ...extra,
});

describe("OpenAI", () => {
  it("lee un comprobante con imagen, esquema estricto y sin guardar la conversación", async () => {
    responder = () => ({ json: respuestaOpenAI(JSON.stringify(lectura)) });
    const { leerComprobante } = await import(".");
    const r = await leerComprobante({ proveedor: "openai", modelo: "gpt-4.1" }, { archivo: foto, texto: "con la Visa" }, contexto);
    expect(r).toEqual(lectura);

    const [p] = peticiones;
    expect(p.url).toBe("/v1/responses");
    expect(p.cabeceras.authorization).toBe("Bearer sk-prueba");
    expect(p.cuerpo).toMatchObject({ model: "gpt-4.1", store: false, max_output_tokens: 4000 });
    expect(p.cuerpo.instructions).toContain("Sofía");
    const formato = (p.cuerpo.text as { format: { type: string; strict: boolean; schema: { required: string[]; additionalProperties: boolean } } }).format;
    expect(formato).toMatchObject({ type: "json_schema", strict: true });
    expect(formato.schema.additionalProperties).toBe(false);
    expect(formato.schema.required).toContain("total");
    const contenido = (p.cuerpo.input as { content: { type: string; image_url?: string; text?: string }[] }[])[0].content;
    expect(contenido[0]).toMatchObject({ type: "input_image", image_url: "data:image/jpeg;base64,AAAA" });
    expect(contenido[1].text).toContain("con la Visa");
  });

  it("manda el PDF del extracto como archivo", async () => {
    responder = () => ({ json: respuestaOpenAI(JSON.stringify({ banco: "Bancolombia", filas: [{ fecha: "2026-10-02", descripcion: "COMPRA EXITO", valor: -50000 }] })) });
    const { leerExtracto } = await import(".");
    const r = await leerExtracto({ proveedor: "openai", modelo: "gpt-6.1-sol" }, pdf, "2026-11-05");
    expect(r.filas).toHaveLength(1);
    const contenido = (peticiones[0].cuerpo.input as { content: { type: string; filename?: string; file_data?: string }[] }[])[0].content;
    expect(contenido[0]).toEqual({ type: "input_file", filename: "extracto.pdf", file_data: "data:application/pdf;base64,JVBERi0=" });
    expect(peticiones[0].cuerpo.max_output_tokens).toBe(32000);
  });

  it("explica un modelo inexistente y una respuesta cortada", async () => {
    const { leerComprobante, leerExtracto } = await import(".");
    responder = () => ({ estado: 404, json: { error: { message: "The model does not exist", type: "invalid_request_error" } } });
    await expect(leerComprobante({ proveedor: "openai", modelo: "gpt-inventado" }, { texto: "almuerzo 25 mil" }, contexto)).rejects.toThrow(
      "El modelo «gpt-inventado» no existe en OpenAI (GPT)",
    );
    responder = () => ({ json: respuestaOpenAI('{"banco":', { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) });
    await expect(leerExtracto({ proveedor: "openai", modelo: "gpt-4.1" }, pdf, "2026-11-05")).rejects.toThrow("demasiado largo");
  });

  // Respuesta real de una cuenta sin créditos (2026-11-05). El SDK reintenta los 429 antes de rendirse.
  it("distingue la cuenta sin saldo de un límite temporal", { timeout: 20000 }, async () => {
    const { leerComprobante } = await import(".");
    const ia = { proveedor: "openai", modelo: "gpt-4.1" } as const;
    responder = () => ({
      estado: 429,
      json: { error: { message: "You have no credits remaining.", type: "insufficient_quota", param: null, code: "credit_balance_exhausted" } },
    });
    await expect(leerComprobante(ia, { texto: "almuerzo 25 mil" }, contexto)).rejects.toThrow("Tu cuenta de OpenAI (GPT) no tiene saldo");
    responder = () => ({ estado: 429, json: { error: { message: "Rate limit reached", type: "requests", code: "rate_limit_exceeded" } } });
    await expect(leerComprobante(ia, { texto: "almuerzo 25 mil" }, contexto)).rejects.toThrow("está limitando el uso");
  });
});

/** Respuesta de Messages en streaming (SSE) con un único bloque de texto. */
function sseAnthropic(texto: string, stop = "end_turn") {
  const ev = (tipo: string, datos: unknown) => `event: ${tipo}\ndata: ${JSON.stringify({ type: tipo, ...(datos as object) })}\n\n`;
  return [
    ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }),
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }),
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: texto } }),
    ev("content_block_stop", { index: 0 }),
    ev("message_delta", { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 20 } }),
    ev("message_stop", {}),
  ].join("");
}

describe("Anthropic", () => {
  it("lee un comprobante en PDF con salida estructurada y esfuerzo bajo en Opus", async () => {
    responder = () => ({ sse: sseAnthropic(JSON.stringify(lectura)) });
    const { leerComprobante } = await import(".");
    const r = await leerComprobante({ proveedor: "anthropic", modelo: "claude-opus-5-5" }, { archivo: pdf }, contexto);
    expect(r.total).toBe(286400);
    const [p] = peticiones;
    expect(p.url).toContain("/v1/messages");
    expect(p.cuerpo).toMatchObject({ model: "claude-opus-5-5", stream: true, fallbacks: "default" });
    expect((p.cuerpo.output_config as { effort?: string; format: { type: string } }).effort).toBe("low");
    expect((p.cuerpo.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    expect((p.cuerpo.messages as { content: { type: string }[] }[])[0].content[0].type).toBe("document");
  });

  it("no envía esfuerzo a Haiku y explica la llave inválida", async () => {
    responder = () => ({ sse: sseAnthropic(JSON.stringify(lectura)) });
    const { leerComprobante } = await import(".");
    await leerComprobante({ proveedor: "anthropic", modelo: "claude-haiku-5-5" }, { texto: "almuerzo 25 mil" }, contexto);
    expect((peticiones[0].cuerpo.output_config as { effort?: string }).effort).toBeUndefined();

    responder = () => ({ estado: 401, json: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } });
    await expect(leerComprobante({ proveedor: "anthropic", modelo: "claude-opus-5-5" }, { texto: "x" }, contexto)).rejects.toThrow(
      "La llave de Anthropic (Claude) no es válida",
    );

    responder = () => ({
      estado: 400,
      json: { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } },
    });
    await expect(leerComprobante({ proveedor: "anthropic", modelo: "claude-opus-5-5" }, { texto: "x" }, contexto)).rejects.toThrow(
      "Tu cuenta de Anthropic (Claude) no tiene saldo",
    );
  });

  it("rechaza datos que no cumplen el esquema", async () => {
    responder = () => ({ sse: sseAnthropic(JSON.stringify({ ...lectura, total: "mucho" })) });
    const { leerComprobante } = await import(".");
    await expect(leerComprobante({ proveedor: "anthropic", modelo: "claude-opus-5-5" }, { texto: "x" }, contexto)).rejects.toThrow("no se pueden leer");
  });
});
