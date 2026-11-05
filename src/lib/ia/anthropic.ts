import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import { ErrorIa, RespuestaCortada, type Archivo, type PeticionEstructurada } from "./tipos";

// Si el modelo declina una solicitud, el servidor la reintenta con el modelo de respaldo que corresponda.
const RESPALDO = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let cliente: Anthropic | null = null;
const anthropic = () => (cliente ??= new Anthropic());

const bloqueArchivo = (a: Archivo): Anthropic.Beta.BetaContentBlockParam =>
  a.mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } }
    : { type: "image", source: { type: "base64", media_type: a.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: a.base64 } };

/** El nivel de esfuerzo solo se envía a los modelos que lo aceptan (Opus y Sonnet). */
const aceptaEsfuerzo = (modelo: string) => /opus|sonnet/i.test(modelo);

/** Claude con salida estructurada. Siempre en streaming: las salidas largas (extractos) lo exigen. */
export async function pedirEstructurado<T extends z.ZodType>(p: PeticionEstructurada<T>): Promise<z.infer<T>> {
  const contenido: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (p.archivo) contenido.push(bloqueArchivo(p.archivo));
  contenido.push({ type: "text", text: p.texto });
  const stream = anthropic().beta.messages.stream({
    model: p.modelo,
    max_tokens: p.maxTokens,
    ...RESPALDO,
    output_config: { ...(p.esfuerzoBajo && aceptaEsfuerzo(p.modelo) ? { effort: "low" as const } : {}), format: betaZodOutputFormat(p.esquema) },
    system: p.sistema,
    messages: [{ role: "user", content: contenido }],
  });
  const respuesta = await stream.finalMessage();
  if (respuesta.stop_reason === "refusal") throw new ErrorIa("El modelo no quiso procesar ese archivo.");
  if (respuesta.stop_reason === "max_tokens") throw new RespuestaCortada("La respuesta del modelo quedó incompleta.");
  const texto = respuesta.content.find((b) => b.type === "text");
  let json: unknown = null;
  try {
    json = texto?.type === "text" ? JSON.parse(texto.text) : null;
  } catch {
    // se reporta abajo
  }
  const datos = p.esquema.safeParse(json);
  if (!datos.success) throw new ErrorIa("El modelo devolvió datos que no se pueden leer.");
  return datos.data;
}
