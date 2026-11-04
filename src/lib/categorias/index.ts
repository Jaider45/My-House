export type Categoria = {
  id: string;
  nombre: string;
  padre_id: string | null;
  clase: "gasto" | "ingreso";
  tipo: "fijo" | "variable";
  es_esencial: boolean;
  excluir_de_costo_vida: boolean;
  archivada: boolean;
};

export type Nodo<T extends Categoria = Categoria> = T & { hijas: T[] };

const porNombre = (a: Categoria, b: Categoria) => a.nombre.localeCompare(b.nombre, "es");

/** Árbol de dos niveles ordenado por nombre. Las hijas cuyo padre no está se tratan como raíz. */
export function construirArbol<T extends Categoria>(categorias: T[]): Nodo<T>[] {
  const ids = new Set(categorias.map((c) => c.id));
  const raices = categorias.filter((c) => !c.padre_id || !ids.has(c.padre_id)).sort(porNombre);
  return raices.map((r) => ({
    ...r,
    hijas: categorias.filter((c) => c.padre_id === r.id).sort(porNombre),
  }));
}

/** Opciones planas para un <select>: "Vivienda", "Vivienda › Arriendo"… (solo activas). */
export function opcionesCategoria<T extends Categoria>(categorias: T[], clase: Categoria["clase"]) {
  return construirArbol(categorias.filter((c) => c.clase === clase && !c.archivada)).flatMap((r) => [
    { id: r.id, etiqueta: r.nombre },
    ...r.hijas.map((h) => ({ id: h.id, etiqueta: `${r.nombre} › ${h.nombre}` })),
  ]);
}

/** Categoría raíz de una categoría (para agrupar en el tablero). */
export function raizDe(categorias: Map<string, Categoria>, id: string): Categoria | undefined {
  const c = categorias.get(id);
  if (!c) return undefined;
  return c.padre_id ? (categorias.get(c.padre_id) ?? c) : c;
}
