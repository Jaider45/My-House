import { parsearMonto } from "@/lib/dinero";
import { parsearFecha, sumarDias } from "@/lib/fechas";

/** Cómo leer el CSV de un banco. Se guarda por cuenta (accounts.mapeo_csv) para reutilizarlo. */
export type Mapeo = {
  fecha: string;
  descripcion: string;
  /** "unico": una columna con signo; "separado": columnas de débito y crédito. */
  modo: "unico" | "separado";
  monto?: string;
  debito?: string;
  credito?: string;
  /** En modo único, si los gastos vienen negativos (lo normal) o positivos. */
  gastosNegativos: boolean;
};

export type FilaLeida = { fila: number; fecha: string; monto: number; tipo: "ingreso" | "gasto"; descripcion: string };
export type ErrorFila = { fila: number; motivo: string };

/** minúsculas, sin tildes, sin signos, espacios colapsados. "  PAGO PSE  Éxito*123 " → "pago pse exito 123" */
export function normalizarDescripcion(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Convierte las filas del CSV (objetos por encabezado) en movimientos, o explica por qué no. */
export function leerFilas(filas: Record<string, string>[], mapeo: Mapeo): { validas: FilaLeida[]; errores: ErrorFila[] } {
  const validas: FilaLeida[] = [];
  const errores: ErrorFila[] = [];
  filas.forEach((f, i) => {
    const fila = i + 1;
    const celdas = Object.values(f).map((v) => (v ?? "").trim());
    if (celdas.every((v) => !v)) return; // fila vacía

    const fecha = parsearFecha(f[mapeo.fecha] ?? "");
    if (!fecha) return errores.push({ fila, motivo: `Fecha no reconocida: «${f[mapeo.fecha] ?? ""}»` });

    let valor: number | null;
    if (mapeo.modo === "separado") {
      const debito = parsearMonto(f[mapeo.debito ?? ""] ?? "") ?? 0;
      const credito = parsearMonto(f[mapeo.credito ?? ""] ?? "") ?? 0;
      valor = Math.abs(credito) - Math.abs(debito);
    } else {
      const v = parsearMonto(f[mapeo.monto ?? ""] ?? "");
      valor = v === null ? null : mapeo.gastosNegativos ? v : -v;
    }
    if (valor === null || valor === 0) return errores.push({ fila, motivo: "Monto vacío o en cero" });

    validas.push({
      fila,
      fecha,
      monto: Math.abs(valor),
      tipo: valor < 0 ? "gasto" : "ingreso",
      descripcion: (f[mapeo.descripcion] ?? "").trim().slice(0, 200),
    });
  });
  return { validas, errores };
}

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Huella de cada fila para no importar dos veces lo mismo. Incluye cuántas veces se repitió la misma
 * fila antes dentro del archivo: dos compras idénticas el mismo día son dos movimientos, y al reimportar
 * un extracto solapado ambas vuelven a dar la misma huella.
 */
export async function huellas(cuentaId: string, filas: FilaLeida[]): Promise<string[]> {
  const vistas = new Map<string, number>();
  return Promise.all(
    filas.map((f) => {
      const base = [cuentaId, f.fecha, f.tipo, f.monto, normalizarDescripcion(f.descripcion)].join("|");
      const n = vistas.get(base) ?? 0;
      vistas.set(base, n + 1);
      return sha256(`${base}|${n}`);
    }),
  );
}

export type Existente = { fecha: string; monto: number; tipo: string; import_hash: string | null; origen: string };
export type Clasificacion = "nuevo" | "duplicado" | "posible";

/**
 * duplicado: la huella ya está en la cuenta (ya se importó).
 * posible: hay un movimiento no importado (manual, recurrente…) del mismo tipo y monto a ±2 días;
 * cada movimiento existente solo "empareja" una fila.
 */
export function clasificar(filas: FilaLeida[], hashes: string[], existentes: Existente[]): Clasificacion[] {
  const importadas = new Set(existentes.map((e) => e.import_hash).filter(Boolean));
  const candidatos = existentes.filter((e) => !e.import_hash).map((e) => ({ ...e, usado: false }));
  return filas.map((f, i) => {
    if (importadas.has(hashes[i])) return "duplicado";
    const desde = sumarDias(f.fecha, -2);
    const hasta = sumarDias(f.fecha, 2);
    const par = candidatos.find((c) => !c.usado && c.tipo === f.tipo && c.monto === f.monto && c.fecha >= desde && c.fecha <= hasta);
    if (par) {
      par.usado = true;
      return "posible";
    }
    return "nuevo";
  });
}

/** Índice de la fila de encabezado: la primera (de las 20 iniciales) con una columna "fecha" y 3+ celdas. */
export function detectarEncabezado(filas: string[][]): number {
  const i = filas
    .slice(0, 20)
    .findIndex((f) => f.filter((c) => c.trim()).length >= 3 && f.some((c) => normalizarDescripcion(c).includes("fecha")));
  return Math.max(i, 0);
}

/** Adivina el mapeo por nombres de columna habituales en extractos colombianos. */
export function sugerirMapeo(columnas: string[]): Mapeo {
  const buscar = (...claves: string[]) =>
    columnas.find((c) => claves.some((k) => normalizarDescripcion(c).includes(k))) ?? "";
  const debito = buscar("debito", "cargo", "retiro");
  const credito = buscar("credito", "abono", "deposito");
  return {
    fecha: buscar("fecha", "date"),
    descripcion: buscar("descripcion", "concepto", "detalle", "referencia", "transaccion"),
    modo: debito && credito ? "separado" : "unico",
    monto: buscar("valor", "monto", "importe", "amount"),
    debito,
    credito,
    gastosNegativos: true,
  };
}
