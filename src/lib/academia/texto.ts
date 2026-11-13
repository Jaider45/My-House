import type { Bloque } from "./index";

/**
 * Editor de lecciones (Consola → Academia): el contenido se escribe como texto y lo demás en campos.
 *   - Párrafos separados por una línea en blanco.
 *   - «## Título» para un subtítulo.
 *   - «+ Título | texto» (líneas seguidas) para tarjetas de opciones.
 * Video, plantilla descargable, «Aplícalo en My House», guía interactiva y pregunta de repaso van en campos aparte y
 * se guardan en este orden: video, contenido, plantilla, aplícalo, guía, repaso. Puro (lo usa el navegador).
 */

export type Extras = {
  video: { url: string; duracion: string } | null;
  plantilla: { titulo: string; url: string } | null;
  aplica: { titulo: string; texto: string; href: string; boton: string } | null;
  guia: { id: string; texto: string } | null;
  quiz: { pregunta: string; opciones: string[]; correcta: number; bien: string; mal: string } | null;
};

export function bloquesATexto(bloques: Bloque[]): { contenido: string; extras: Extras } {
  const partes: string[] = [];
  const extras: Extras = { video: null, plantilla: null, aplica: null, guia: null, quiz: null };
  for (const b of bloques) {
    if ("p" in b) partes.push(b.p);
    else if ("h2" in b) partes.push(`## ${b.h2}`);
    else if ("opciones" in b) partes.push(b.opciones.map((o) => `+ ${o.titulo} | ${o.texto}`).join("\n"));
    else if ("video" in b) extras.video = b.video;
    else if ("plantilla" in b) extras.plantilla = b.plantilla;
    else if ("aplica" in b) extras.aplica = b.aplica;
    else if ("guia" in b) extras.guia = b.guia;
    else if ("quiz" in b) extras.quiz = b.quiz;
  }
  return { contenido: partes.join("\n\n"), extras };
}

export function textoABloques(contenido: string, extras: Extras): Bloque[] {
  const out: Bloque[] = [];
  if (extras.video?.url) out.push({ video: extras.video });
  for (const parte of contenido.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const t = parte.trim();
    if (!t) continue;
    const lineas = t.split("\n").map((l) => l.trim());
    if (lineas.every((l) => l.startsWith("+ "))) {
      out.push({
        opciones: lineas.map((l) => {
          const [titulo, ...resto] = l.slice(2).split("|");
          return { titulo: titulo.trim(), texto: resto.join("|").trim() };
        }),
      });
    } else if (lineas.length === 1 && t.startsWith("## ")) out.push({ h2: t.slice(3).trim() });
    else out.push({ p: lineas.join(" ") });
  }
  if (extras.plantilla?.url) out.push({ plantilla: extras.plantilla });
  if (extras.aplica?.href && extras.aplica.boton) out.push({ aplica: extras.aplica });
  if (extras.guia?.id) out.push({ guia: extras.guia as { id: never; texto: string } });
  if (extras.quiz?.pregunta && extras.quiz.opciones.length >= 2) out.push({ quiz: extras.quiz });
  return out;
}

/** Formatos de la lección (chips de la consola). */
export function formatos(bloques: Bloque[]): string[] {
  const f: string[] = [];
  if (bloques.some((b) => "p" in b || "h2" in b || "opciones" in b)) f.push("Lectura");
  if (bloques.some((b) => "video" in b)) f.push("Video");
  if (bloques.some((b) => "quiz" in b)) f.push("Pregunta de repaso");
  if (bloques.some((b) => "plantilla" in b)) f.push("Plantilla descargable");
  return f;
}

/** Lo que falta para publicar una lección (vacío = lista). */
export function problemasLeccion(titulo: string, minutos: number, bloques: Bloque[]): string[] {
  const p: string[] = [];
  if (titulo.trim().length < 5) p.push("Escribe el título.");
  if (!(minutos >= 1 && minutos <= 60)) p.push("El tiempo de lectura va de 1 a 60 minutos.");
  if (!bloques.some((b) => "p" in b || "video" in b)) p.push("Agrega contenido o un video.");
  for (const b of bloques) {
    if ("video" in b && !/^https:\/\//.test(b.video.url)) p.push("El video necesita una dirección https://.");
    if ("plantilla" in b && !/^https:\/\//.test(b.plantilla.url)) p.push("La plantilla necesita una dirección https://.");
    if ("aplica" in b && !b.aplica.href.startsWith("/")) p.push("«Aplícalo en My House» abre una pantalla de la app (ruta que empieza por /).");
    if ("quiz" in b && (b.quiz.correcta < 0 || b.quiz.correcta >= b.quiz.opciones.length)) p.push("Marca cuál es la respuesta correcta del repaso.");
  }
  return p;
}
