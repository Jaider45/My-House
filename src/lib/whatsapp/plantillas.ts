/**
 * Plantillas de WhatsApp (Consola → Plantillas de WhatsApp): validación previa con las reglas de Meta y el cuerpo que
 * se manda a `POST /{waba_id}/message_templates`. Puro y liviano (lo usa el editor en el navegador y el servidor).
 */

export type Categoria = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type Boton = { tipo: "QUICK_REPLY" | "URL"; texto: string; url?: string };
export type Plantilla = {
  nombre: string;
  idioma: string;
  categoria: Categoria;
  encabezado: string; // vacío = sin encabezado
  cuerpo: string;
  ejemplos: string[];
  pie: string;
  botones: Boton[];
};

export const CATEGORIAS: { valor: Categoria; texto: string; ayuda: string }[] = [
  { valor: "UTILITY", texto: "Utilidad", ayuda: "Avisos de algo que la persona ya tiene: pagos, cuentas, recordatorios." },
  { valor: "MARKETING", texto: "Marketing", ayuda: "Ofertas y novedades. Solo para quienes aceptaron recibirlas." },
  { valor: "AUTHENTICATION", texto: "Autenticación", ayuda: "Códigos de acceso. Meta limita su formato." },
];

export const LIMITES = { cuerpo: 1024, encabezado: 60, pie: 60, boton: 25, botones: 3 };

/** Variables {{1}}, {{2}}… en orden de aparición (sin repetir). */
export function variables(texto: string): number[] {
  const vistas: number[] = [];
  for (const m of texto.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const n = Number(m[1]);
    if (!vistas.includes(n)) vistas.push(n);
  }
  return vistas;
}

/** Texto con los ejemplos en lugar de las variables (vista previa del celular). */
export function conEjemplos(texto: string, ejemplos: string[]): string {
  return texto.replace(/\{\{\s*(\d+)\s*\}\}/g, (todo, n: string) => ejemplos[Number(n) - 1] || todo);
}

const PALABRAS_RIESGO = [/contrase(ñ|n)a/i, /n(ú|u)mero de (la )?tarjeta/i, /\bcvv\b/i, /clave (del|de tu) banco/i, /gana(r|s)? dinero/i, /pr(é|e)stamo inmediato/i, /dinero f(á|a)cil/i];

export type Revision = { errores: string[]; avisos: string[] };

/** Las reglas que Meta revisa (errores bloquean el envío) y lo que suele causar rechazos (avisos). */
export function revisar(p: Plantilla): Revision {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (!/^[a-z][a-z0-9_]{0,511}$/.test(p.nombre)) errores.push("El nombre va en minúsculas, con guion bajo y sin espacios (ej.: recordatorio_pago).");
  const cuerpo = p.cuerpo.trim();
  if (!cuerpo) errores.push("Escribe el mensaje.");
  if (cuerpo.length > LIMITES.cuerpo) errores.push(`El mensaje pasa de ${LIMITES.cuerpo} caracteres.`);
  if (p.encabezado.length > LIMITES.encabezado) errores.push(`El encabezado pasa de ${LIMITES.encabezado} caracteres.`);
  if (/\{\{/.test(p.encabezado)) errores.push("El encabezado de texto no lleva variables en esta versión.");
  if (p.pie.length > LIMITES.pie) errores.push(`El pie pasa de ${LIMITES.pie} caracteres.`);
  if (/\{\{/.test(p.pie)) errores.push("El pie no puede llevar variables.");
  const vars = variables(cuerpo);
  const esperadas = vars.map((_, i) => i + 1);
  if (vars.some((v, i) => v !== esperadas[i])) errores.push("Las variables van en orden y sin saltos: {{1}}, {{2}}, {{3}}…");
  if (/^\s*\{\{\s*\d+\s*\}\}/.test(cuerpo) || /\{\{\s*\d+\s*\}\}[\s.!?]*$/.test(cuerpo)) errores.push("El mensaje no puede empezar ni terminar con una variable.");
  if (/\{\{\s*\d+\s*\}\}\s*\{\{\s*\d+\s*\}\}/.test(cuerpo)) errores.push("Dos variables no pueden ir pegadas.");
  if (vars.length && cuerpo.replace(/\{\{\s*\d+\s*\}\}/g, "").trim().split(/\s+/).length < vars.length * 3) avisos.push("Hay muchas variables para tan poco texto: Meta suele rechazarlo.");
  const faltan = vars.filter((v) => !p.ejemplos[v - 1]?.trim());
  if (faltan.length) errores.push(`Falta el ejemplo de ${faltan.map((v) => `{{${v}}}`).join(", ")} (Meta lo exige para revisar).`);
  if (p.botones.length > LIMITES.botones) errores.push(`Máximo ${LIMITES.botones} botones.`);
  for (const b of p.botones) {
    if (!b.texto.trim()) errores.push("Hay un botón sin texto.");
    if (b.texto.length > LIMITES.boton) errores.push(`«${b.texto}» pasa de ${LIMITES.boton} caracteres.`);
    if (b.tipo === "URL" && !/^https:\/\/[^\s]+$/.test(b.url ?? "")) errores.push(`El botón «${b.texto}» necesita una dirección https://.`);
  }
  if (p.categoria === "AUTHENTICATION" && (p.botones.some((b) => b.tipo === "URL") || p.encabezado)) errores.push("Las de autenticación no llevan encabezado ni botones de enlace.");
  const todo = `${p.encabezado} ${cuerpo} ${p.pie}`;
  if (PALABRAS_RIESGO.some((r) => r.test(todo))) avisos.push("El mensaje parece pedir datos bancarios o prometer dinero: Meta lo rechaza y afecta la calidad del número.");
  if (p.categoria === "UTILITY" && /(descuento|oferta|promo|gratis|\d+\s?%)/i.test(todo)) avisos.push("Parece marketing: si la marcas como Utilidad, Meta la puede reclasificar o rechazar.");
  return { errores, avisos };
}

/** Cuerpo para la API de Meta (Graph `message_templates`). */
export function cuerpoMeta(p: Plantilla) {
  const components: Record<string, unknown>[] = [];
  if (p.encabezado.trim()) components.push({ type: "HEADER", format: "TEXT", text: p.encabezado.trim() });
  const vars = variables(p.cuerpo);
  components.push({ type: "BODY", text: p.cuerpo.trim(), ...(vars.length && { example: { body_text: [vars.map((v) => p.ejemplos[v - 1].trim())] } }) });
  if (p.pie.trim()) components.push({ type: "FOOTER", text: p.pie.trim() });
  if (p.botones.length)
    components.push({
      type: "BUTTONS",
      buttons: p.botones.map((b) => (b.tipo === "URL" ? { type: "URL", text: b.texto.trim(), url: b.url!.trim() } : { type: "QUICK_REPLY", text: b.texto.trim() })),
    });
  return { name: p.nombre, language: p.idioma, category: p.categoria, components };
}

/** Estado de Meta → el de la consola. */
export function estadoDeMeta(status: string): "aprobada" | "rechazada" | "en_revision" | "pausada" {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "aprobada";
  if (s === "REJECTED" || s === "DISABLED") return "rechazada";
  if (s === "PAUSED") return "pausada";
  return "en_revision";
}
