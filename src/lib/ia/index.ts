import "server-only";
import type * as z from "zod/v4";
import type { obtenerContexto } from "@/lib/sesion";
import { leerConfigHogar } from "@/lib/hogar";
import * as anthropic from "./anthropic";
import * as openai from "./openai";
import { LecturaComprobante, LecturaExtracto, mensajeComprobante, sistemaComprobante, sistemaExtracto, type ContextoLectura } from "./esquemas";
import { leerIntegracion } from "@/lib/integraciones/servidor";
import { llaveDe, NOMBRE_PROVEEDOR, resolverIa, type ConfigIa, type Entorno } from "./proveedores";
import { ErrorIa, RespuestaCortada, type Archivo, type PeticionEstructurada, type UsoIa } from "./tipos";

/**
 * Lectura de comprobantes y extractos con IA (visión + PDF, salida estructurada), con Claude o con GPT.
 * Las llaves (ANTHROPIC_API_KEY, OPENAI_API_KEY) viven solo en el servidor; el hogar elige proveedor y modelo
 * en Configuración → Hogar.
 */

export { LecturaComprobante, LecturaExtracto, type ContextoLectura } from "./esquemas";
export type { Archivo, UsoIa } from "./tipos";
export type { ConfigIa } from "./proveedores";

export class IaNoConfigurada extends Error {
  constructor() {
    super("El asistente no está configurado: conecta Anthropic u OpenAI en la consola (Integraciones).");
  }
}

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

/**
 * Llaves y modelos de IA efectivos: los conectados en la consola (Integraciones) o, si no, las variables de entorno.
 * Solo en el servidor: nunca pasar este objeto a un componente de cliente.
 */
export async function entornoIa(): Promise<Entorno> {
  const [a, o] = await Promise.all([leerIntegracion("anthropic"), leerIntegracion("openai")]);
  return {
    IA_PROVEEDOR: process.env.IA_PROVEEDOR,
    ANTHROPIC_API_KEY: a?.valores.api_key,
    ANTHROPIC_MODEL: a?.valores.modelo || process.env.ANTHROPIC_MODEL,
    OPENAI_API_KEY: o?.valores.api_key,
    OPENAI_MODEL: o?.valores.modelo || process.env.OPENAI_MODEL,
  };
}

/** Proveedor y modelo del hogar (o null si no hay ninguna llave). */
export async function iaDelHogar(ctx: Ctx): Promise<ConfigIa | null> {
  const [{ data }, entorno] = await Promise.all([ctx.supabase.from("households").select("config").eq("id", ctx.hogar.id).single(), entornoIa()]);
  return resolverIa(leerConfigHogar(data?.config).ia, entorno);
}

/** Traduce los errores de las API a algo que la familia (o quien administra) pueda resolver. */
export function explicarError(e: unknown, ia: ConfigIa): string {
  if (e instanceof ErrorIa) return e.message;
  const estado = (e as { status?: number })?.status;
  const proveedor = NOMBRE_PROVEEDOR[ia.proveedor];
  // Sin saldo: OpenAI responde 429 (insufficient_quota / credit_balance_exhausted) y Anthropic 400 ("credit balance
  // is too low"). No es un límite temporal: reintentar no sirve.
  const detalle = e as { code?: unknown; type?: unknown; message?: unknown };
  const textoError = [detalle?.code, detalle?.type, detalle?.message].filter((x) => typeof x === "string").join(" ");
  if ((estado === 429 || estado === 400 || estado === 402) && /insufficient_quota|credit|billing/i.test(textoError))
    return `Tu cuenta de ${proveedor} no tiene saldo. Agrega créditos en su panel de facturación y vuelve a intentarlo.`;
  if (estado === 401 || estado === 403) return `La llave de ${proveedor} no es válida o no tiene permiso.`;
  if (estado === 404) return `El modelo «${ia.modelo}» no existe en ${proveedor} o tu llave no tiene acceso. Cámbialo en Configuración → Hogar.`;
  if (estado === 400) return `${proveedor} rechazó el archivo con el modelo «${ia.modelo}». Prueba otro modelo con visión o una foto más nítida.`;
  if (estado === 429) return `${proveedor} está limitando el uso en este momento. Intenta de nuevo en un minuto.`;
  if (estado && estado >= 500) return `${proveedor} no está respondiendo. Intenta de nuevo en un momento.`;
  // Los SDK validan la salida estructurada por su cuenta y lanzan su propio error si no cumple el esquema.
  if (!estado && e instanceof Error && /parse|json|zod|schema/i.test(e.message)) return "El modelo devolvió datos que no se pueden leer. Intenta de nuevo.";
  return "No pude comunicarme con el servicio de IA.";
}

async function pedir<T extends z.ZodType>(ia: ConfigIa, p: Omit<PeticionEstructurada<T>, "modelo">): Promise<z.infer<T>> {
  const adaptador = ia.proveedor === "openai" ? openai : anthropic;
  try {
    const llave = (await entornoIa())[llaveDe(ia.proveedor)];
    return await adaptador.pedirEstructurado({ ...p, modelo: ia.modelo, llave });
  } catch (e) {
    if (e instanceof RespuestaCortada) throw e;
    throw new ErrorIa(explicarError(e, ia));
  }
}

/** Lee un comprobante (foto o PDF) o un mensaje de texto con un gasto. */
export async function leerComprobante(
  ia: ConfigIa,
  entrada: { archivo?: Archivo; texto?: string },
  contexto: ContextoLectura,
  alUsar?: (uso: UsoIa) => void,
): Promise<LecturaComprobante> {
  return pedir(ia, {
    alUsar,
    sistema: sistemaComprobante(contexto),
    archivo: entrada.archivo,
    texto: mensajeComprobante({ conArchivo: Boolean(entrada.archivo), texto: entrada.texto }),
    esquema: LecturaComprobante,
    nombre: "lectura_comprobante",
    maxTokens: 4000,
    esfuerzoBajo: true,
  });
}

/** Extrae los movimientos de un extracto bancario o de tarjeta en PDF. */
export async function leerExtracto(ia: ConfigIa, pdf: Archivo, hoy: string, alUsar?: (uso: UsoIa) => void): Promise<LecturaExtracto> {
  try {
    return await pedir(ia, {
      alUsar,
      sistema: sistemaExtracto(hoy),
      archivo: pdf,
      texto: "Extrae todos los movimientos de este extracto.",
      esquema: LecturaExtracto,
      nombre: "lectura_extracto",
      // GPT-4.1 admite hasta 32.768 tokens de salida; Claude, bastante más.
      maxTokens: ia.proveedor === "openai" ? 32000 : 64000,
      esfuerzoBajo: true,
    });
  } catch (e) {
    if (e instanceof RespuestaCortada) throw new ErrorIa("El extracto es demasiado largo: divídelo por meses e impórtalo por partes.");
    throw e;
  }
}
