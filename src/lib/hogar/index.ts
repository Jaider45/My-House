import { z } from "zod";

/**
 * Configuración del hogar guardada en households.config (jsonb). Se lee siempre con `leerConfigHogar`
 * (valores por defecto y tolerante a claves viejas) y se escribe con `fusionarConfigHogar`
 * para no borrar claves que otra pantalla guardó.
 */

export const PROVEEDORES_IA = ["anthropic", "openai"] as const;
export type ProveedorIa = (typeof PROVEEDORES_IA)[number];

export type ConfigHogar = {
  cuota_imprevistos_pct: number;
  /** Texto libre que el asistente lee para entender el hogar (quiénes son, a qué se dedican…). */
  contexto: string;
  /** null = lo que diga el servidor (variables de entorno). */
  ia: { proveedor: ProveedorIa | null; modelo: string | null };
};

export const MAX_CONTEXTO = 600;
/** Identificador de modelo: letras, números, punto, guion, dos puntos y guion bajo. */
export const PATRON_MODELO = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,63}$/;

const esquema = z.object({
  cuota_imprevistos_pct: z.coerce.number().int().min(0).max(50).catch(10),
  contexto: z.string().max(MAX_CONTEXTO).catch(""),
  ia: z
    .object({
      proveedor: z.enum(PROVEEDORES_IA).nullable().catch(null),
      modelo: z.string().regex(PATRON_MODELO).nullable().catch(null),
    })
    .catch({ proveedor: null, modelo: null }),
});

export function leerConfigHogar(config: unknown): ConfigHogar {
  const base = typeof config === "object" && config !== null ? config : {};
  return esquema.parse({ cuota_imprevistos_pct: 10, contexto: "", ia: {}, ...base });
}

/** Aplica cambios parciales sin perder lo demás de la configuración (incluidas claves desconocidas). */
export function fusionarConfigHogar(actual: unknown, cambios: Partial<ConfigHogar>): Record<string, unknown> {
  const base = typeof actual === "object" && actual !== null ? (actual as Record<string, unknown>) : {};
  return { ...base, ...leerConfigHogar(base), ...cambios };
}

// ── Personas a cargo ──────────────────────────────────────────────────────────

export const PARENTESCOS = {
  hijo: "Hijo o hija",
  pareja: "Pareja",
  padre_madre: "Padre o madre",
  hermano: "Hermano o hermana",
  otro: "Otro familiar",
} as const;
export type Parentesco = keyof typeof PARENTESCOS;

/** Edad cumplida en años a la fecha `hoy` (ambas YYYY-MM-DD). */
export function edad(fechaNacimiento: string, hoy: string): number {
  const [an, mn, dn] = fechaNacimiento.split("-").map(Number);
  const [ah, mh, dh] = hoy.split("-").map(Number);
  return ah - an - (mh < mn || (mh === mn && dh < dn) ? 1 : 0);
}

export type PersonaHogar = {
  id: string;
  nombre: string;
  es_dependiente: boolean;
  parentesco: Parentesco | null;
  fecha_nacimiento: string | null;
  a_cargo_de: string | null;
  nota: string | null;
};

/** Resumen del hogar en una línea por persona, para darle contexto al asistente de comprobantes. */
export function describirHogar(personas: PersonaHogar[], contexto: string, hoy: string): string {
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]));
  const lineas = personas.map((p) => {
    const partes = [p.es_dependiente ? "persona a cargo" : "adulto con acceso a la app"];
    if (p.parentesco) partes.push(PARENTESCOS[p.parentesco].toLowerCase());
    if (p.fecha_nacimiento) partes.push(`${edad(p.fecha_nacimiento, hoy)} años`);
    if (p.a_cargo_de && nombre.has(p.a_cargo_de)) partes.push(`a cargo de ${nombre.get(p.a_cargo_de)}`);
    if (p.nota) partes.push(p.nota);
    return `- ${p.nombre}: ${partes.join(", ")}`;
  });
  return [lineas.length ? `Personas del hogar:\n${lineas.join("\n")}` : "", contexto.trim() ? `Lo que la familia cuenta del hogar: ${contexto.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
}
