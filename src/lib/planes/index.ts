/*
 * Planes del SaaS (roadmap S2). Módulo liviano (sin zod ni supabase): lo usan componentes de cliente y la consola.
 * Los límites los hace cumplir la base (migración planes); esto solo los muestra.
 */

export type Limites = {
  personas?: number | null;
  comprobantes_mes?: number | null;
  almacenamiento_mb?: number | null;
  metas?: boolean;
  renta_reporte?: boolean;
  whatsapp?: boolean;
  hogares?: number | null;
  comision_pct?: number | null;
  panel_clientes?: boolean;
  descarga_masiva?: boolean;
  recordatorios_masivos?: boolean;
};

export type Plan = {
  codigo: string;
  nombre: string;
  descripcion: string;
  para: "hogar" | "contador" | string;
  precio_mensual: number;
  precio_anual: number;
  limites: Limites;
  orden: number;
  publicado: boolean;
};

export type UsoPlan = { personas: number; comprobantes_mes: number; almacenamiento_mb: number };

export type EstadoPlan = {
  plan: string;
  efectivo: string;
  estado: "activo" | "suspendido";
  prueba_hasta: string | null;
  prueba_usada: boolean;
  uso: UsoPlan;
};

type Clave = keyof Limites;

/** Cómo se muestra cada límite (orden de las tarjetas de planes y del editor de la consola). */
export const LIMITES: { clave: Clave; texto: string; tipo: "numero" | "si_no"; unidad?: string; para: "hogar" | "contador" | "ambos" }[] = [
  { clave: "personas", texto: "Personas con acceso", tipo: "numero", para: "ambos" },
  { clave: "comprobantes_mes", texto: "Comprobantes con IA al mes", tipo: "numero", para: "hogar" },
  { clave: "almacenamiento_mb", texto: "Almacenamiento de soportes", tipo: "numero", unidad: "MB", para: "ambos" },
  { clave: "metas", texto: "Metas de ahorro y pronóstico", tipo: "si_no", para: "hogar" },
  { clave: "renta_reporte", texto: "Reporte anual de renta", tipo: "si_no", para: "hogar" },
  { clave: "whatsapp", texto: "Registro por WhatsApp", tipo: "si_no", para: "hogar" },
  { clave: "hogares", texto: "Hogares clientes", tipo: "numero", para: "contador" },
  { clave: "panel_clientes", texto: "Panel de clientes", tipo: "si_no", para: "contador" },
  { clave: "descarga_masiva", texto: "Descarga masiva de soportes", tipo: "si_no", para: "contador" },
  { clave: "recordatorios_masivos", texto: "Recordatorios masivos", tipo: "si_no", para: "contador" },
  { clave: "comision_pct", texto: "Comisión por referidos", tipo: "numero", unidad: "%", para: "contador" },
];

/** «200 MB», «2 GB», «Ilimitados», «5». */
export function textoLimite(clave: Clave, valor: unknown): string {
  if (valor === null || valor === undefined) return clave === "comprobantes_mes" ? "Ilimitados" : "Sin límite";
  if (typeof valor === "boolean") return valor ? "Incluido" : "No incluido";
  const n = Number(valor);
  if (clave === "almacenamiento_mb") return n >= 1024 ? `${Number((n / 1024).toFixed(1)).toLocaleString("es-CO")} GB` : `${n} MB`;
  if (clave === "comision_pct") return `${n} %`;
  return n.toLocaleString("es-CO");
}

/** Porcentaje de uso de un límite numérico (0–100); null si no hay tope. */
export function porcentajeUso(usado: number, tope: number | null | undefined): number | null {
  if (tope === null || tope === undefined) return null;
  if (tope <= 0) return 100;
  return Math.min(100, Math.round((usado / tope) * 100));
}

/** Ahorro del plan anual frente a 12 meses: «2 meses gratis» si el anual equivale a 10 mensualidades. */
export function ahorroAnual(mensual: number, anual: number): { pesos: number; meses: number } {
  const pesos = Math.max(0, mensual * 12 - anual);
  return { pesos, meses: mensual > 0 ? Math.floor(pesos / mensual) : 0 };
}

/** Días que le quedan a la prueba (redondeo hacia arriba); 0 si ya terminó o no hay. */
export function diasDePrueba(pruebaHasta: string | null, ahora: Date = new Date()): number {
  if (!pruebaHasta) return 0;
  const ms = new Date(pruebaHasta).getTime() - ahora.getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}
