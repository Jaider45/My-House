import * as z from "zod/v4";

/** Esquemas de salida y textos de sistema, comunes a todos los proveedores de IA. */

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

export type ContextoLectura = {
  hoy: string;
  categorias: string[];
  cuentas: string[];
  etiquetas: string[];
  /** Personas del hogar y lo que la familia contó (describirHogar). Puede ir vacío. */
  hogar?: string;
};

export const sistemaComprobante = (c: ContextoLectura) =>
  `Eres el asistente de comprobantes de My House, una app de finanzas de un hogar en Colombia.
Lees facturas, recibos, capturas de transferencias (Nequi, Daviplata, bancos) y mensajes cortos, y devuelves los datos para registrar el movimiento.
Hoy es ${c.hoy} (zona America/Bogota). Los montos están en pesos colombianos: el punto separa miles («$ 286.400» son 286400).
Usa el total final pagado (con impuestos y propina), no subtotales. Si el año no aparece, asume el más reciente que no sea futuro.
Categorías de gasto e ingreso del hogar: ${c.categorias.join(", ")}.
Cuentas del hogar: ${c.cuentas.join(", ")}.
Etiquetas tributarias: ${c.etiquetas.join(", ")}.${c.hogar ? `\n${c.hogar}\nUsa este contexto para elegir la categoría (p. ej. colegio o pediatra de los niños) y la etiqueta «Dependientes» cuando el gasto sea de una persona a cargo.` : ""}
Si algo no se lee con seguridad, déjalo en null y pon una pregunta corta en español (tuteo) en "pregunta".`;

export const mensajeComprobante = (entrada: { conArchivo: boolean; texto?: string }) =>
  entrada.conArchivo
    ? `Lee este comprobante${entrada.texto ? `. La familia escribió: «${entrada.texto}»` : ""}.`
    : `La familia escribió: «${entrada.texto ?? ""}». Si describe un gasto o ingreso, extrae sus datos.`;

export const sistemaExtracto = (hoy: string) => `Extraes movimientos de extractos bancarios y de tarjetas de crédito de Colombia. Hoy es ${hoy}.
Los montos van en pesos enteros (el punto separa miles). Incluye cada movimiento una sola vez, también los de varias páginas.
No incluyas saldos iniciales o finales, totales, cupos ni resúmenes. En tarjetas, las compras y avances son negativos y los pagos a la tarjeta positivos.`;
