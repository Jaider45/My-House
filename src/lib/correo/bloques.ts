/**
 * Bloques de las campañas (Consola → Correos y campañas → editor): título, texto, botón, imagen, cifra del hogar,
 * lección de la Academia, cupón y separador. Puro y liviano: lo usa el editor (vista previa) y el envío.
 * Variables: {nombre}, {hogar}, {minimo}, {plan}, {fecha_pago}.
 */

export type BloqueCorreo =
  | { tipo: "titulo"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "boton"; texto: string; url: string; estilo: "principal" | "secundario" | "texto"; alinear: "izquierda" | "centro" | "ancho" }
  | { tipo: "imagen"; url: string; alt: string }
  | { tipo: "cifra"; etiqueta: string; valor: string }
  | { tipo: "leccion"; titulo: string; url: string }
  | { tipo: "cupon"; codigo: string; texto: string }
  | { tipo: "separador" };

export type TipoBloque = BloqueCorreo["tipo"];

export const PALETA: { tipo: TipoBloque; texto: string; icono: "documentos" | "meta" | "casa" | "resumen" | "educacion" | "cuentas" | "egresos" }[] = [
  { tipo: "titulo", texto: "Título", icono: "documentos" },
  { tipo: "texto", texto: "Texto", icono: "documentos" },
  { tipo: "boton", texto: "Botón", icono: "meta" },
  { tipo: "imagen", texto: "Imagen", icono: "casa" },
  { tipo: "cifra", texto: "Cifra del hogar", icono: "resumen" },
  { tipo: "leccion", texto: "Lección de la Academia", icono: "educacion" },
  { tipo: "cupon", texto: "Cupón", icono: "cuentas" },
  { tipo: "separador", texto: "Separador", icono: "egresos" },
];

export function bloqueNuevo(tipo: TipoBloque): BloqueCorreo {
  switch (tipo) {
    case "titulo":
      return { tipo, texto: "{nombre}, un título que diga el beneficio" };
    case "texto":
      return { tipo, texto: "Un párrafo corto: qué hay de nuevo y por qué le sirve a tu hogar." };
    case "boton":
      return { tipo, texto: "Ver planes", url: "/ajustes/plan", estilo: "principal", alinear: "izquierda" };
    case "imagen":
      return { tipo, url: "", alt: "" };
    case "cifra":
      return { tipo, etiqueta: "Tu número mínimo de este mes", valor: "{minimo}" };
    case "leccion":
      return { tipo, titulo: "¿Qué es el número mínimo del hogar?", url: "/academia/finanzas/numero-minimo" };
    case "cupon":
      return { tipo, codigo: "CODIGO", texto: "Úsalo al pagar tu plan." };
    case "separador":
      return { tipo };
  }
}

export const VARIABLES = ["nombre", "hogar", "minimo", "plan", "fecha_pago"] as const;
export type Variables = Partial<Record<(typeof VARIABLES)[number], string>>;

/** Reemplaza {variable}; si falta el dato, una forma neutra («tu hogar», «Hola»). */
export function conVariables(texto: string, v: Variables): string {
  const neutro: Record<string, string> = { nombre: "Hola", hogar: "tu hogar", minimo: "—", plan: "tu plan", fecha_pago: "la próxima fecha" };
  return texto.replace(/\{(nombre|hogar|minimo|plan|fecha_pago)\}/g, (_, k: string) => v[k as keyof Variables] || neutro[k]);
}

/** Todos los textos de los bloques con las variables reemplazadas. */
export function bloquesConVariables(bloques: BloqueCorreo[], v: Variables): BloqueCorreo[] {
  return bloques.map((b) => {
    const r = { ...b } as Record<string, unknown>;
    for (const k of ["texto", "titulo", "etiqueta", "valor", "alt"]) if (typeof r[k] === "string") r[k] = conVariables(r[k] as string, v);
    return r as BloqueCorreo;
  });
}

/** Lo que falta para poder programar (vacío = lista). */
export function problemasCampana(c: { asunto: string; bloques: BloqueCorreo[] }): string[] {
  const p: string[] = [];
  if (!c.asunto.trim()) p.push("Escribe el asunto.");
  if (!c.bloques.length) p.push("Agrega al menos un bloque.");
  for (const b of c.bloques) {
    if (b.tipo === "boton" && (!b.texto.trim() || !/^(https:\/\/|\/(?!\/))/.test(b.url))) p.push("Cada botón necesita texto y un enlace (ruta de la app o https://).");
    if (b.tipo === "imagen" && !/^https:\/\//.test(b.url)) p.push("La imagen necesita una dirección https://.");
    if (b.tipo === "leccion" && !b.url.startsWith("/academia")) p.push("La lección debe ser de la Academia (/academia/…).");
  }
  return [...new Set(p)];
}

/** Variante A/B de un destinatario: estable por hogar (el mismo hogar cae siempre igual). */
export function variante(hogar: string, pct: number): "a" | "b" {
  if (!pct) return "a";
  let h = 0;
  for (const ch of hogar) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100 < pct ? "b" : "a";
}
