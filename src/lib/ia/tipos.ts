import type * as z from "zod/v4";

export type Archivo = { mime: string; base64: string; nombre: string };

/** Lo que cada proveedor sabe hacer: un mensaje (archivo opcional + texto) → JSON validado con Zod. */
export type PeticionEstructurada<T extends z.ZodType> = {
  modelo: string;
  sistema: string;
  archivo?: Archivo;
  texto: string;
  esquema: T;
  nombre: string;
  /** Tope de salida; los extractos largos necesitan más. */
  maxTokens: number;
  /** Poco razonamiento: extraer datos no lo necesita y responde más rápido. */
  esfuerzoBajo?: boolean;
};

/** Error con mensaje listo para la familia. */
export class ErrorIa extends Error {}
export class RespuestaCortada extends ErrorIa {}
