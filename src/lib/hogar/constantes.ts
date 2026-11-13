/**
 * Constantes del hogar que también usan los componentes de cliente. Este archivo NO importa `zod` (ni nada
 * pesado): si un formulario las tomara de `@/lib/hogar` (index.ts, que sí usa zod), el navegador descargaría
 * zod completo (~107 KB, 30 KB comprimidos) solo por dos constantes. Ver docs/MEJORAS.md («Rendimiento React»).
 */

export const PROVEEDORES_IA = ["anthropic", "openai"] as const;
export type ProveedorIa = (typeof PROVEEDORES_IA)[number];

export const MAX_CONTEXTO = 600;
/** Identificador de modelo: letras, números, punto, guion, dos puntos y guion bajo. */
export const PATRON_MODELO = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,63}$/;

export const PARENTESCOS = {
  hijo: "Hijo o hija",
  pareja: "Pareja",
  padre_madre: "Padre o madre",
  hermano: "Hermano o hermana",
  otro: "Otro familiar",
} as const;
export type Parentesco = keyof typeof PARENTESCOS;

/** Roles de las personas del hogar: nombre, lo que pueden hacer y tono del chip (diseño «Configuración»). */
export const ROLES_HOGAR = {
  admin: { nombre: "Administrador", puede: "Todo, incluida la configuración", tono: "info" },
  editor: { nombre: "Pareja", puede: "Registra, edita y aprueba pagos", tono: "ok" },
  familiar: { nombre: "Familiar", puede: "Solo registra gastos", tono: "neutro" },
  contador: { nombre: "Contador · solo lectura", puede: "Ve movimientos, Renta DIAN y soportes", tono: "alerta" },
} as const;
export type RolHogar = keyof typeof ROLES_HOGAR;
export const nombreRol = (r: RolHogar) => ROLES_HOGAR[r]?.nombre ?? r;
