import type { ReactNode } from "react";

/**
 * Markdown sencillo para textos que escribe el equipo en la consola (documentos legales, lecciones, ofertas):
 * `## Título`, `### Subtítulo`, `- lista`, `1. lista`, `> cita`, `**negrita**`, `*cursiva*` y `[texto](url)`.
 * Arma elementos de React (nunca HTML crudo): lo que no se reconoce queda como texto. Enlaces solo http(s), mailto y
 * rutas internas. Las variables `{nombre}` se reemplazan antes con `variables` (las desconocidas quedan igual).
 */

export type Bloque =
  | { tipo: "h2" | "h3" | "p" | "cita"; texto: string }
  | { tipo: "ul" | "ol"; items: string[] };

export function reemplazarVariables(texto: string, variables: Record<string, string> = {}): string {
  return texto.replace(/\{([a-z_]{2,30})\}/g, (todo, k: string) => (k in variables ? variables[k] : todo));
}

export function bloques(md: string): Bloque[] {
  const out: Bloque[] = [];
  let parrafo: string[] = [];
  const cerrar = () => {
    if (parrafo.length) out.push({ tipo: "p", texto: parrafo.join(" ") });
    parrafo = [];
  };
  for (const cruda of md.replace(/\r\n?/g, "\n").split("\n")) {
    const l = cruda.trim();
    if (!l) {
      cerrar();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(#{2,3})\s+(.+)$/))) {
      cerrar();
      out.push({ tipo: m[1].length === 2 ? "h2" : "h3", texto: m[2] });
    } else if ((m = l.match(/^[-*•]\s+(.+)$/)) || (m = l.match(/^\d{1,3}[.)]\s+(.+)$/))) {
      cerrar();
      const tipo = /^\d/.test(l) ? "ol" : "ul";
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.tipo === tipo) ultimo.items.push(m[1]);
      else out.push({ tipo, items: [m[1]] });
    } else if ((m = l.match(/^>\s?(.*)$/))) {
      cerrar();
      out.push({ tipo: "cita", texto: m[1] });
    } else {
      parrafo.push(l);
    }
  }
  cerrar();
  return out;
}

const URL_OK = /^(https?:\/\/|mailto:|\/(?!\/))/i;

/** Negrita, cursiva y enlaces dentro de una línea. */
export function enLinea(texto: string, claveBase = "t"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let desde = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > desde) out.push(texto.slice(desde, m.index));
    const k = `${claveBase}-${i++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{enLinea(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{enLinea(m[2], k)}</em>);
    else if (URL_OK.test(m[4]))
      out.push(
        <a key={k} href={m[4]} className="font-semibold text-monte underline underline-offset-2" {...(/^https?:/i.test(m[4]) && { target: "_blank", rel: "noreferrer" })}>
          {m[3]}
        </a>,
      );
    else out.push(m[3]);
    desde = re.lastIndex;
  }
  if (desde < texto.length) out.push(texto.slice(desde));
  return out;
}

export function Markdown({ texto, variables, className }: { texto: string; variables?: Record<string, string>; className?: string }) {
  const lista = bloques(reemplazarVariables(texto, variables));
  return (
    <div className={className ?? "space-y-3 text-[15px] leading-6"}>
      {lista.map((b, i) => {
        const k = `b${i}`;
        switch (b.tipo) {
          case "h2":
            return (
              <h2 key={k} className="pt-4 text-lg leading-7 font-bold">
                {enLinea(b.texto, k)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={k} className="pt-2 text-base font-bold">
                {enLinea(b.texto, k)}
              </h3>
            );
          case "cita":
            return (
              <blockquote key={k} className="border-l-4 border-borde pl-4 text-cuerpo">
                {enLinea(b.texto, k)}
              </blockquote>
            );
          case "ul":
          case "ol": {
            const Lista = b.tipo;
            return (
              <Lista key={k} className={b.tipo === "ul" ? "list-disc space-y-1.5 pl-5 marker:text-tenue" : "list-decimal space-y-1.5 pl-5 marker:text-tenue"}>
                {b.items.map((it, j) => (
                  <li key={j}>{enLinea(it, `${k}-${j}`)}</li>
                ))}
              </Lista>
            );
          }
          default:
            return <p key={k}>{enLinea(b.texto, k)}</p>;
        }
      })}
    </div>
  );
}
