import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

/**
 * Lectura de comprobantes y extractos con Claude (visión + PDF, salida estructurada).
 * Requiere ANTHROPIC_API_KEY en el servidor; nunca se expone al navegador.
 */

const MODELO = "claude-opus-5-5";
// Si el modelo declina una solicitud, el servidor la reintenta con el modelo de respaldo que corresponda.
const RESPALDO = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export class IaNoConfigurada extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY: el asistente de comprobantes no está configurado en este servidor.");
  }
}

let cliente: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new IaNoConfigurada();
  return (cliente ??= new Anthropic());
}

export type Archivo = { mime: string; base64: string; nombre: string };

const bloqueArchivo = (a: Archivo): Anthropic.Beta.BetaContentBlockParam =>
  a.mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } }
    : { type: "image", source: { type: "base64", media_type: a.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: a.base64 } };

// ── Comprobantes ─────────────────────────────────────────────────────────────

export const LecturaComprobante = z.object({
  es_comprobante: z.boolean().describe("false si la imagen o el texto no describe un pago, compra o ingreso"),
  tipo: z.enum(["gasto", "ingreso"]),
  comercio: z.string().describe("Nombre corto del comercio, persona o entidad (p. ej. «Éxito Calle 80», «Enel»)"),
  fecha: z.string().nullable().describe("Fecha del pago en formato YYYY-MM-DD, o null si no se lee"),
  total: z.number().int().nullable().describe("Total pagado en pesos colombianos, entero y positivo, sin centavos; null si no se lee"),
  categoria: z.string().nullable().describe("Exactamente uno de los nombres de categoría dados, o null si ninguno encaja"),
  confianza: z.number().int().describe("0 a 100: qué tan seguro estás de comercio, total, fecha y categoría juntos"),
  cuenta: z.string().nullable().describe("Exactamente uno de los nombres de cuenta dados si el comprobante muestra el medio de pago; si no, null"),
  etiqueta_dian: z.string().nullable().describe("Exactamente una de las etiquetas tributarias dadas si aplica (medicina prepagada, dependientes…), o null"),
  ambito: z.enum(["personal", "negocio"]).nullable().describe("negocio solo si es claramente un gasto o ingreso del trabajo independiente; null si no se sabe"),
  pregunta: z.string().nullable().describe("Si falta un dato para registrarlo, la pregunta corta para la familia; si no falta nada, null"),
});
export type LecturaComprobante = z.infer<typeof LecturaComprobante>;

export type ContextoLectura = { hoy: string; categorias: string[]; cuentas: string[]; etiquetas: string[] };

const instrucciones = (c: ContextoLectura) => `Eres el asistente de comprobantes de My House, una app de finanzas de un hogar en Colombia.
Lees facturas, recibos, capturas de transferencias (Nequi, Daviplata, bancos) y mensajes cortos, y devuelves los datos para registrar el movimiento.
Hoy es ${c.hoy} (zona America/Bogota). Los montos están en pesos colombianos: el punto separa miles («$ 286.400» son 286400).
Usa el total final pagado (con impuestos y propina), no subtotales. Si el año no aparece, asume el más reciente que no sea futuro.
Categorías de gasto e ingreso del hogar: ${c.categorias.join(", ")}.
Cuentas del hogar: ${c.cuentas.join(", ")}.
Etiquetas tributarias: ${c.etiquetas.join(", ")}.
Si algo no se lee con seguridad, déjalo en null y pon una pregunta corta en español (tuteo) en "pregunta".`;

/** Lee un comprobante (foto o PDF) o un mensaje de texto con un gasto. */
export async function leerComprobante(entrada: { archivo?: Archivo; texto?: string }, contexto: ContextoLectura): Promise<LecturaComprobante> {
  const contenido: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (entrada.archivo) contenido.push(bloqueArchivo(entrada.archivo));
  contenido.push({
    type: "text",
    text: entrada.archivo
      ? `Lee este comprobante${entrada.texto ? `. La familia escribió: «${entrada.texto}»` : ""}.`
      : `La familia escribió: «${entrada.texto ?? ""}». Si describe un gasto o ingreso, extrae sus datos.`,
  });
  const respuesta = await anthropic().beta.messages.parse({
    model: MODELO,
    max_tokens: 4000,
    ...RESPALDO,
    output_config: { effort: "low", format: betaZodOutputFormat(LecturaComprobante) },
    system: instrucciones(contexto),
    messages: [{ role: "user", content: contenido }],
  });
  if (respuesta.stop_reason === "refusal" || !respuesta.parsed_output) {
    throw new Error("No pude leer ese comprobante. Intenta con una foto más nítida.");
  }
  return respuesta.parsed_output;
}

// ── Extractos bancarios en PDF ────────────────────────────────────────────────

export const LecturaExtracto = z.object({
  banco: z.string().nullable(),
  filas: z
    .array(
      z.object({
        fecha: z.string().describe("YYYY-MM-DD"),
        descripcion: z.string().describe("Descripción tal como aparece en el extracto"),
        valor: z.number().int().describe("Pesos enteros: negativo para débitos, cargos y compras; positivo para abonos y consignaciones"),
      }),
    )
    .describe("Todos los movimientos del extracto, en orden; sin saldos, totales ni intereses informativos"),
});
export type LecturaExtracto = z.infer<typeof LecturaExtracto>;

/** Extrae los movimientos de un extracto bancario o de tarjeta en PDF. */
export async function leerExtracto(pdf: Archivo, hoy: string): Promise<LecturaExtracto> {
  const stream = anthropic().beta.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    ...RESPALDO,
    output_config: { effort: "low", format: betaZodOutputFormat(LecturaExtracto) },
    system: `Extraes movimientos de extractos bancarios y de tarjetas de crédito de Colombia. Hoy es ${hoy}.
Los montos van en pesos enteros (el punto separa miles). Incluye cada movimiento una sola vez, también los de varias páginas.
No incluyas saldos iniciales o finales, totales, cupos ni resúmenes. En tarjetas, las compras y avances son negativos y los pagos a la tarjeta positivos.`,
    messages: [{ role: "user", content: [bloqueArchivo(pdf), { type: "text", text: "Extrae todos los movimientos de este extracto." }] }],
  });
  const respuesta = await stream.finalMessage();
  if (respuesta.stop_reason === "refusal") throw new Error("No pude leer ese extracto.");
  if (respuesta.stop_reason === "max_tokens") throw new Error("El extracto es demasiado largo: divídelo por meses e impórtalo por partes.");
  const texto = respuesta.content.find((b) => b.type === "text");
  const datos = LecturaExtracto.safeParse(texto?.type === "text" ? JSON.parse(texto.text) : null);
  if (!datos.success) throw new Error("No pude leer los movimientos de ese extracto.");
  return datos.data;
}
