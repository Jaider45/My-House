/*
 * Reporte de renta para el contador (diseño «Renta DIAN → Exportar para el contador»). Puro: con los datos del año
 * arma el archivo para Excel (CSV con «;», como lo abre Excel en Colombia, y BOM para que respete las tildes).
 * La versión en PDF es la página imprimible /reporte-renta (Imprimir → Guardar como PDF).
 */

export type FilaTope = { persona: string; tope: string; acumulado: number; topePesos: number; porcentaje: number; estado: string };
export type FilaEtiqueta = { etiqueta: string; movimientos: number; total: number; conSoporte: number };
export type FilaMovimiento = { fecha: string; persona: string | null; concepto: string; etiqueta: string; tipo: string; monto: number; soporte: boolean };

export type DatosReporte = {
  hogar: string;
  anio: number;
  generado: string;
  unidad: string;
  valorUnidad: number | null;
  topes: FilaTope[];
  etiquetas: FilaEtiqueta[];
  movimientos: FilaMovimiento[];
};

const ESTADO: Record<string, string> = { verde: "Bajo el tope", amarillo: "Cerca", rojo: "Obligado" };

/** Celda segura para CSV: comillas si hace falta y sin fórmulas (una celda que empieza por = + - @ se neutraliza). */
export function celda(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let t = v.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(t)) t = `'${t}`;
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const linea = (valores: (string | number | null | undefined)[]) => valores.map(celda).join(";");

/** Estado del soporte de una etiqueta: «Completo», «Faltan N» o «Sin soportes». */
export function estadoSoportes(e: Pick<FilaEtiqueta, "movimientos" | "conSoporte">): { texto: string; tono: "ok" | "alerta" | "error" } {
  if (e.conSoporte >= e.movimientos) return { texto: "Completo", tono: "ok" };
  if (e.conSoporte === 0) return { texto: "Sin soportes", tono: "error" };
  return { texto: `Faltan ${e.movimientos - e.conSoporte}`, tono: "alerta" };
}

export function csvReporte(d: DatosReporte): string {
  const filas: string[] = [];
  filas.push(linea([`Reporte de renta · año gravable ${d.anio}`]));
  filas.push(linea(["Hogar", d.hogar]));
  filas.push(linea(["Generado", d.generado]));
  if (d.valorUnidad) filas.push(linea([`Valor ${d.unidad} ${d.anio}`, d.valorUnidad]));
  filas.push(linea(["Cálculo orientativo con lo registrado en My House. La decisión final es del contador."]));
  filas.push("");
  filas.push(linea(["TOPES PARA DECLARAR"]));
  filas.push(linea(["Persona", "Tope", "Acumulado", "Tope en pesos", "Porcentaje", "Estado"]));
  for (const t of d.topes) filas.push(linea([t.persona, t.tope, t.acumulado, t.topePesos, t.porcentaje, ESTADO[t.estado] ?? t.estado]));
  filas.push("");
  filas.push(linea(["TOTALES POR ETIQUETA TRIBUTARIA"]));
  filas.push(linea(["Etiqueta", "Movimientos", "Total", "Con soporte", "Soportes"]));
  for (const e of d.etiquetas) filas.push(linea([e.etiqueta, e.movimientos, e.total, e.conSoporte, estadoSoportes(e).texto]));
  filas.push("");
  filas.push(linea(["MOVIMIENTOS CON ETIQUETA"]));
  filas.push(linea(["Fecha", "Persona", "Concepto", "Etiqueta", "Tipo", "Monto", "Soporte"]));
  for (const m of d.movimientos) filas.push(linea([m.fecha, m.persona, m.concepto, m.etiqueta, m.tipo, m.monto, m.soporte ? "Sí" : "No"]));
  return `﻿${filas.join("\r\n")}\r\n`;
}
