import type * as z from "zod/v4";

export type Archivo = { mime: string; base64: string; nombre: string };

/** Lo que cada proveedor sabe hacer: un mensaje (archivo opcional + texto) → JSON validado con Zod. */
export type PeticionEstructurada<T extends z.ZodType> = {
  modelo: string;
  /** Llave del proveedor (Integraciones o entorno). Sin ella, el SDK la toma de su variable de entorno. */
  llave?: string;
  sistema: string;
  archivo?: Archivo;
  texto: string;
  esquema: T;
  nombre: string;
  /** Tope de salida; los extractos largos necesitan más. */
  maxTokens: number;
  /** Poco razonamiento: extraer datos no lo necesita y responde más rápido. */
  esfuerzoBajo?: boolean;
  /** Recibe los tokens usados (para el costo de la consola → IA). */
  alUsar?: (uso: UsoIa) => void;
};

/** Tokens de una llamada al modelo. */
export type UsoIa = { modelo: string; entrada: number; salida: number };

/** Error con mensaje listo para la familia. */
export class ErrorIa extends Error {}
export class RespuestaCortada extends ErrorIa {}
