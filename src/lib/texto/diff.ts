/**
 * Comparación de dos versiones de un texto («Comparar con v2.1» en Legal): primero por párrafos y, en los que
 * cambiaron, palabra por palabra. LCS clásico: los documentos tienen cientos de párrafos, no millones.
 */

export type Trozo = { tipo: "igual" | "mas" | "menos"; texto: string };
export type Parrafo = { tipo: "igual" | "nuevo" | "quitado" | "cambiado"; trozos: Trozo[] };

function lcs<T>(a: T[], b: T[], igual: (x: T, y: T) => boolean): ["igual" | "mas" | "menos", T][] {
  const n = a.length;
  const m = b.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = igual(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: ["igual" | "mas" | "menos", T][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (igual(a[i], b[j])) {
      out.push(["igual", b[j]]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) out.push(["menos", a[i++]]);
    else out.push(["mas", b[j++]]);
  }
  while (i < n) out.push(["menos", a[i++]]);
  while (j < m) out.push(["mas", b[j++]]);
  return out;
}

/** Diferencias palabra por palabra (los espacios viajan con la palabra anterior). */
export function diffPalabras(antes: string, despues: string): Trozo[] {
  const partir = (s: string) => s.match(/\S+\s*/g) ?? [];
  const out: Trozo[] = [];
  for (const [tipo, palabra] of lcs(partir(antes), partir(despues), (x, y) => x.trim() === y.trim())) {
    const ultimo = out[out.length - 1];
    if (ultimo?.tipo === tipo) ultimo.texto += palabra;
    else out.push({ tipo, texto: palabra });
  }
  return out;
}

const parrafos = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n|\n(?=\s*(?:[-*•]|\d{1,3}[.)]|#{2,3})\s)/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Párrafos con su cambio. Un quitado seguido de un nuevo se muestra como un solo párrafo cambiado. */
export function diffTexto(antes: string, despues: string): Parrafo[] {
  const pasos = lcs(parrafos(antes), parrafos(despues), (x, y) => x === y);
  const out: Parrafo[] = [];
  for (let k = 0; k < pasos.length; k++) {
    const [tipo, p] = pasos[k];
    if (tipo === "igual") out.push({ tipo: "igual", trozos: [{ tipo: "igual", texto: p }] });
    else if (tipo === "menos" && pasos[k + 1]?.[0] === "mas") {
      out.push({ tipo: "cambiado", trozos: diffPalabras(p, pasos[k + 1][1]) });
      k++;
    } else if (tipo === "menos") out.push({ tipo: "quitado", trozos: [{ tipo: "menos", texto: p }] });
    else out.push({ tipo: "nuevo", trozos: [{ tipo: "mas", texto: p }] });
  }
  return out;
}
