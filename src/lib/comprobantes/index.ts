import { normalizarDescripcion } from "@/lib/importacion";
import { parsearFecha } from "@/lib/fechas";

/** Lo que devuelve el modelo (ver src/lib/ia). Se repite aquí para que esta lógica no dependa del SDK. */
export type Lectura = {
  es_comprobante: boolean;
  tipo: "gasto" | "ingreso";
  comercio: string;
  fecha: string | null;
  total: number | null;
  categoria: string | null;
  confianza: number;
  cuenta: string | null;
  etiqueta_dian: string | null;
  ambito: "personal" | "negocio" | null;
  pregunta: string | null;
};

export type Opcion = { id: string; nombre: string };
export type ReglaComercio = { patron: string; category_id: string; ambito: "personal" | "negocio" | null; activa: boolean };

export type Decision =
  | { accion: "descartar"; motivo: string }
  | {
      accion: "registrar" | "revisar";
      pregunta: string | null;
      tipo: "gasto" | "ingreso";
      comercio: string;
      fecha: string | null;
      monto: number | null;
      category_id: string | null;
      account_id: string | null;
      tax_tag_id: string | null;
      ambito: "personal" | "negocio";
      /** La categoría vino de una regla aprendida y no del modelo. */
      porRegla: boolean;
    };

/** Confianza mínima para registrar sin preguntar. */
export const CONFIANZA_MINIMA = 70;

const clave = (t: string) => normalizarDescripcion(t);
const buscar = (opciones: Opcion[], nombre: string | null) => (nombre ? (opciones.find((o) => clave(o.nombre) === clave(nombre))?.id ?? null) : null);

/** Regla activa cuyo patrón aparece en el comercio; si varias, la más específica (patrón más largo). */
export function reglaPara(comercio: string, reglas: ReglaComercio[]): ReglaComercio | undefined {
  const c = ` ${clave(comercio)} `;
  return reglas
    .filter((r) => r.activa && c.includes(` ${clave(r.patron)} `))
    .sort((a, b) => b.patron.length - a.patron.length)[0];
}

/** Patrón para aprender una regla a partir del comercio: las dos primeras palabras significativas. */
export function patronDe(comercio: string): string {
  return clave(comercio)
    .split(" ")
    .filter((p) => p.length > 2 && !/^\d+$/.test(p))
    .slice(0, 2)
    .join(" ");
}

/**
 * Decide qué hacer con un comprobante leído: registrarlo, pedir que se revise (falta un dato o la lectura es
 * dudosa) o descartarlo (no es un comprobante). La duplicidad contra movimientos existentes se revisa aparte.
 */
export function decidir(
  l: Lectura,
  o: { categorias: Opcion[]; cuentas: Opcion[]; etiquetas: Opcion[]; reglas: ReglaComercio[]; hoy: string; cuentaPorDefecto: string | null },
): Decision {
  if (!l.es_comprobante) return { accion: "descartar", motivo: l.pregunta ?? "No parece un comprobante de pago." };

  const regla = reglaPara(l.comercio, o.reglas);
  const category_id = regla?.category_id ?? buscar(o.categorias, l.categoria);
  const fecha = l.fecha ? parsearFecha(l.fecha) : null;
  const fechaValida = fecha && fecha <= o.hoy ? fecha : null;
  const monto = l.total && l.total > 0 ? Math.round(l.total) : null;

  const faltante = !monto
    ? "¿Cuánto fue el total?"
    : !fechaValida
      ? "¿De qué fecha es?"
      : !category_id
        ? `¿En qué categoría va ${l.comercio || "este pago"}?`
        : !regla && l.confianza < CONFIANZA_MINIMA
          ? (l.pregunta ?? "¿Confirmas estos datos?")
          : null;

  return {
    accion: faltante ? "revisar" : "registrar",
    pregunta: faltante ? (l.pregunta && faltante !== "¿Confirmas estos datos?" ? l.pregunta : faltante) : null,
    tipo: l.tipo,
    comercio: l.comercio.trim().slice(0, 200),
    fecha: fechaValida,
    monto,
    category_id,
    account_id: buscar(o.cuentas, l.cuenta) ?? o.cuentaPorDefecto,
    tax_tag_id: buscar(o.etiquetas, l.etiqueta_dian),
    ambito: regla?.ambito ?? l.ambito ?? "personal",
    porRegla: !!regla,
  };
}
