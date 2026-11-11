/**
 * Calendario de renta de personas naturales (consola → Parámetros DIAN): la DIAN lo publica como «01-02: 12 de
 * agosto», una fecha por par de dígitos finales de la cédula. Módulo liviano (lo usa un componente de cliente).
 */

export type FechaCalendario = { d: number; fecha: string };

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** «2027-08-12», «12/08/2027» o «12-08-2027» → AAAA-MM-DD (o null si no es una fecha real). */
function leerFecha(texto: string): string | null {
  let m = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  let [a, mes, dia] = m ? [m[1], m[2], m[3]] : [];
  if (!m) {
    m = texto.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (!m) return null;
    [dia, mes, a] = [m[1], m[2], m[3]];
  }
  const iso = `${a}-${mes!.padStart(2, "0")}-${dia!.padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * Una línea por fecha: «01-02 2027-08-12», «01 al 02: 12/08/2027», «99-00 2027-10-24» (00 = 100, va al final).
 * Exige las 100 terminaciones, sin repetir, con fechas del año siguiente al gravable.
 */
export function leerCalendario(texto: string, anioGravable: number): { fechas: FechaCalendario[] } | { error: string } {
  const porDigito = new Map<number, string>();
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, linea] of lineas.entries()) {
    const fecha = leerFecha(linea);
    const rango = linea.match(/^(\d{1,2})\s*(?:-|al|a|y)?\s*(\d{1,2})?(?=\D)/i);
    if (!fecha || !rango) return { error: `Línea ${i + 1}: escribe «01-02 2027-08-12» (dígitos y fecha).` };
    if (Number(fecha.slice(0, 4)) !== anioGravable + 1) return { error: `Línea ${i + 1}: la fecha debe ser de ${anioGravable + 1}.` };
    const desde = Number(rango[1]);
    const hasta = rango[2] === undefined ? desde : Number(rango[2]);
    if (desde > 99 || hasta > 99) return { error: `Línea ${i + 1}: los dígitos van de 00 a 99.` };
    // «99-00»: el 00 (100) va después del 99.
    const fin = hasta < desde ? hasta + 100 : hasta;
    for (let n = desde; n <= fin; n++) {
      const d = n % 100;
      if (porDigito.has(d)) return { error: `La terminación ${dosDigitos(d)} está repetida.` };
      porDigito.set(d, fecha);
    }
  }
  const faltan = Array.from({ length: 100 }, (_, d) => d).filter((d) => !porDigito.has(d));
  if (faltan.length) return { error: `Faltan ${faltan.length} terminaciones: ${faltan.slice(0, 8).map(dosDigitos).join(", ")}${faltan.length > 8 ? "…" : ""}.` };
  return { fechas: [...porDigito].map(([d, fecha]) => ({ d, fecha })).sort((a, b) => ((a.d || 100) - (b.d || 100))) };
}

/** Agrupa terminaciones seguidas con la misma fecha: [{desde: "01", hasta: "02", fecha}] (el 00 va al final). */
export function agruparCalendario(fechas: FechaCalendario[]): { desde: string; hasta: string; fecha: string }[] {
  const orden = [...fechas].sort((a, b) => (a.d || 100) - (b.d || 100));
  const grupos: { desde: string; hasta: string; fecha: string }[] = [];
  for (const f of orden) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fecha === f.fecha) ultimo.hasta = dosDigitos(f.d);
    else grupos.push({ desde: dosDigitos(f.d), hasta: dosDigitos(f.d), fecha: f.fecha });
  }
  return grupos;
}

/** Texto editable a partir del calendario guardado (inverso de `leerCalendario`). */
export function calendarioATexto(fechas: FechaCalendario[]): string {
  return agruparCalendario(fechas)
    .map((g) => `${g.desde === g.hasta ? g.desde : `${g.desde}-${g.hasta}`} ${g.fecha}`)
    .join("\n");
}
