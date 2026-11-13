/**
 * Academia (diseño «Academia» y «Lección»): rutas de aprendizaje con lecciones cortas y en tuteo. Puro: sin base ni
 * React; las rutas llegan de la base (Consola → Academia, `cargarCursos`). El avance de cada persona se guarda en
 * `user_metadata.academia` (claves «curso/lección») y en `academia_vistas` (para las métricas de la consola).
 * Los textos son orientativos: no reemplazan a un contador o asesor financiero (lo dice la pantalla).
 */
import type { NombreIcono } from "@/components/marca";
import type { IdGuia } from "@/lib/guias";

export type Bloque =
  | { p: string }
  | { video: { url: string; duracion: string } }
  | { plantilla: { titulo: string; url: string } }
  | { h2: string }
  | { opciones: { titulo: string; texto: string }[] }
  | { aplica: { titulo: string; texto: string; href: string; boton: string } }
  | { guia: { id: IdGuia; texto: string } }
  | { quiz: { pregunta: string; opciones: string[]; correcta: number; bien: string; mal: string } };

export type Leccion = { slug: string; titulo: string; minutos: number; bloques: Bloque[] };

export type Tema = "app" | "finanzas" | "ahorro" | "renta" | "deudas";

export type Curso = {
  slug: string;
  titulo: string;
  /** Texto corto del encabezado de la tarjeta (miniatura). */
  portada: string;
  descripcion: string;
  tema: Tema;
  icono: NombreIcono;
  /** Color de la miniatura (diseño: monte, teja, mar, arena). */
  color: "monte" | "teja" | "mar" | "arena";
  lecciones: Leccion[];
};

export const TEMAS: Record<Tema, string> = {
  app: "Uso de la app",
  finanzas: "Finanzas",
  ahorro: "Ahorro",
  renta: "Renta DIAN",
  deudas: "Deudas",
};

export const GLOSARIO: { termino: string; texto: string }[] = [
  { termino: "Número mínimo", texto: "Lo que la casa necesita cada mes: pagos fijos, gastos esenciales y una cuota para imprevistos." },
  { termino: "Costo de vida", texto: "Lo que cuesta sostener la casa en el mes, por categoría: lo presupuestado o lo gastado si es más." },
  { termino: "UVT", texto: "Unidad de Valor Tributario. La DIAN la fija cada año y con ella se calculan los topes." },
  { termino: "Fondo de emergencia", texto: "Plata guardada para vivir de 3 a 6 meses sin ingresos." },
  { termino: "GMF o 4 × 1.000", texto: "Impuesto a los movimientos bancarios. La mitad de lo pagado se puede deducir en la renta." },
  { termino: "Pago fijo", texto: "Un gasto que se repite con el mismo monto: arriendo, servicios, colegio, planes." },
  { termino: "Gasto variable", texto: "Lo que cambia cada mes: mercado, transporte, salidas. Ahí está el margen para ajustar." },
  { termino: "Pronóstico de cierre", texto: "Cuánto habrás gastado el último día del mes si sigues al mismo ritmo." },
];

export const claveLeccion = (curso: string, leccion: string) => `${curso}/${leccion}`;

export const cursoPorSlug = (cursos: Curso[], slug: string) => cursos.find((c) => c.slug === slug);

export function leccionDe(cursos: Curso[], curso: string, leccion: string) {
  const c = cursoPorSlug(cursos, curso);
  const i = c?.lecciones.findIndex((l) => l.slug === leccion) ?? -1;
  if (!c || i < 0) return null;
  return { curso: c, leccion: c.lecciones[i], indice: i, anterior: c.lecciones[i - 1], siguiente: c.lecciones[i + 1] };
}

/** Lecciones vistas de `user_metadata.academia`: solo claves que existen. */
export function leerVistasAcademia(metadata: unknown, cursos: Curso[]): string[] {
  const lista = (metadata as { academia?: unknown } | null | undefined)?.academia;
  if (!Array.isArray(lista)) return [];
  const validas = new Set(cursos.flatMap((c) => c.lecciones.map((l) => claveLeccion(c.slug, l.slug))));
  return lista.filter((x): x is string => typeof x === "string" && validas.has(x));
}

/** Avance de un curso: lecciones vistas, minutos que faltan y la siguiente por ver. */
export function avanceCurso(curso: Curso, vistas: Set<string>) {
  const hechas = curso.lecciones.filter((l) => vistas.has(claveLeccion(curso.slug, l.slug)));
  const pendientes = curso.lecciones.filter((l) => !vistas.has(claveLeccion(curso.slug, l.slug)));
  return {
    hechas: hechas.length,
    total: curso.lecciones.length,
    porcentaje: curso.lecciones.length ? Math.round((hechas.length * 100) / curso.lecciones.length) : 0,
    faltanMinutos: pendientes.reduce((s, l) => s + l.minutos, 0),
    siguiente: pendientes[0] ?? null,
    completo: pendientes.length === 0,
  };
}

/** «Sigue donde ibas»: el curso empezado y sin terminar con más avance. */
export function continuar(cursos: Curso[], vistas: Set<string>) {
  return (
    cursos
      .map((c) => ({ curso: c, ...avanceCurso(c, vistas) }))
      .filter((a) => a.hechas > 0 && !a.completo)
      .sort((a, b) => b.porcentaje - a.porcentaje)[0] ?? null
  );
}

/** Búsqueda simple en títulos y textos de las lecciones (sin tildes ni mayúsculas). */
export function buscar(cursos: Curso[], texto: string) {
  const n = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = n(texto.trim());
  if (q.length < 2) return [];
  return cursos.flatMap((c) =>
    c.lecciones
      .filter((l) => n(`${l.titulo} ${l.bloques.map((b) => ("p" in b ? b.p : "h2" in b ? b.h2 : "")).join(" ")}`).includes(q))
      .map((l) => ({ curso: c, leccion: l })),
  );
}
