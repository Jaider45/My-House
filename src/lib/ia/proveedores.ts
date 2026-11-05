import { PATRON_MODELO, PROVEEDORES_IA, type ConfigHogar, type ProveedorIa } from "@/lib/hogar";

/**
 * Qué proveedor y modelo de IA usa un hogar. Las llaves viven solo en variables de entorno del servidor
 * (nunca en la base); el hogar elige entre los proveedores que tengan llave y puede fijar el modelo.
 */

export const NOMBRE_PROVEEDOR: Record<ProveedorIa, string> = { anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)" };

const LLAVE: Record<ProveedorIa, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };
const MODELO_ENTORNO: Record<ProveedorIa, string> = { anthropic: "ANTHROPIC_MODEL", openai: "OPENAI_MODEL" };

export const MODELO_POR_DEFECTO: Record<ProveedorIa, string> = { anthropic: "claude-opus-5-5", openai: "gpt-6.1-sol" };

/** Sugerencias del formulario. Se puede escribir cualquier otro modelo con visión. */
export const MODELOS_SUGERIDOS: Record<ProveedorIa, string[]> = {
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: ["gpt-6.1-sol", "gpt-6-luna", "gpt-5.4-mini", "gpt-4.1"],
};

export type Entorno = Record<string, string | undefined>;
export type ConfigIa = { proveedor: ProveedorIa; modelo: string };

export const llaveDe = (p: ProveedorIa) => LLAVE[p];

export function proveedoresDisponibles(env: Entorno): ProveedorIa[] {
  return PROVEEDORES_IA.filter((p) => Boolean(env[LLAVE[p]]?.trim()));
}

const modeloValido = (m: string | null | undefined) => (m && PATRON_MODELO.test(m.trim()) ? m.trim() : null);

/**
 * Proveedor y modelo efectivos. Orden: lo que eligió el hogar (si ese proveedor tiene llave),
 * luego IA_PROVEEDOR del servidor, luego el primero con llave. null = no hay ninguna llave.
 */
export function resolverIa(elegido: ConfigHogar["ia"], env: Entorno): ConfigIa | null {
  const disponibles = proveedoresDisponibles(env);
  if (!disponibles.length) return null;
  const delServidor = disponibles.find((p) => p === env.IA_PROVEEDOR?.trim().toLowerCase());
  const proveedor = (elegido.proveedor && disponibles.includes(elegido.proveedor) ? elegido.proveedor : null) ?? delServidor ?? disponibles[0];
  const modelo =
    (elegido.proveedor === proveedor ? modeloValido(elegido.modelo) : null) ?? modeloValido(env[MODELO_ENTORNO[proveedor]]) ?? MODELO_POR_DEFECTO[proveedor];
  return { proveedor, modelo };
}
