import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type * as z from "zod/v4";
import { ErrorIa, RespuestaCortada, type Archivo, type PeticionEstructurada } from "./tipos";

// Un cliente por llave: si cambian la llave en la consola, el siguiente pedido usa la nueva.
const clientes = new Map<string, OpenAI>();
const openai = (llave?: string) => {
  let c = clientes.get(llave ?? "");
  if (!c) clientes.set(llave ?? "", (c = new OpenAI(llave ? { apiKey: llave } : {})));
  return c;
};

type Contenido = OpenAI.Responses.ResponseInputContent;

const bloqueArchivo = (a: Archivo): Contenido =>
  a.mime === "application/pdf"
    ? { type: "input_file", filename: a.nombre || "documento.pdf", file_data: `data:application/pdf;base64,${a.base64}` }
    : { type: "input_image", detail: "auto", image_url: `data:${a.mime};base64,${a.base64}` };

/** GPT con salida estructurada (Responses API, JSON Schema estricto generado desde Zod). */
export async function pedirEstructurado<T extends z.ZodType>(p: PeticionEstructurada<T>): Promise<z.infer<T>> {
  const contenido: Contenido[] = [];
  if (p.archivo) contenido.push(bloqueArchivo(p.archivo));
  contenido.push({ type: "input_text", text: p.texto });
  const respuesta = await openai(p.llave).responses.parse({
    model: p.modelo,
    instructions: p.sistema,
    input: [{ role: "user", content: contenido }],
    max_output_tokens: p.maxTokens,
    store: false, // datos financieros: que OpenAI no guarde la conversación
    text: { format: zodTextFormat(p.esquema, p.nombre) },
  });
  p.alUsar?.({ modelo: respuesta.model ?? p.modelo, entrada: respuesta.usage?.input_tokens ?? 0, salida: respuesta.usage?.output_tokens ?? 0 });
  if (respuesta.status === "incomplete") {
    if (respuesta.incomplete_details?.reason === "max_output_tokens") throw new RespuestaCortada("La respuesta del modelo quedó incompleta.");
    throw new ErrorIa("El modelo no quiso procesar ese archivo.");
  }
  const refusal = respuesta.output.some((o) => o.type === "message" && o.content.some((c) => c.type === "refusal"));
  if (refusal) throw new ErrorIa("El modelo no quiso procesar ese archivo.");
  const datos = p.esquema.safeParse(respuesta.output_parsed);
  if (!datos.success) throw new ErrorIa("El modelo devolvió datos que no se pueden leer.");
  return datos.data;
}
