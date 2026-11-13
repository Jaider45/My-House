/**
 * Sugerencias de Registrar: lo último que se registró con un concepto («Terpel», «droguería») da la categoría y la
 * cuenta que se proponen la próxima vez. Puro (lo usa el navegador).
 */

/** Lo último que se registró con un concepto: de ahí sale la categoría y la cuenta que se sugieren. */
export type Sugerencia = { texto: string; tipo: "gasto" | "ingreso"; category_id: string; account_id: string };

export const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** El concepto escrito coincide con uno reciente: igual, o uno empieza por el otro (mínimo 3 letras). */
export function buscarSugerencia(concepto: string, tipo: "gasto" | "ingreso", lista: Sugerencia[]): Sugerencia | undefined {
  const n = normalizar(concepto);
  if (n.length < 3) return undefined;
  const delTipo = lista.filter((s) => s.tipo === tipo);
  return (
    delTipo.find((s) => normalizar(s.texto) === n) ??
    delTipo.find((s) => normalizar(s.texto).startsWith(n)) ??
    delTipo.find((s) => n.startsWith(normalizar(s.texto)) && normalizar(s.texto).length >= 3)
  );
}

