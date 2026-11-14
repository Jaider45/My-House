/*
 * Segmentos de campañas, compartidos por la página (servidor) y el formulario (cliente). Van en su propio módulo:
 * importar constantes desde un archivo "use client" hacia un componente de servidor entrega referencias de cliente,
 * no valores (TypeError en producción).
 */
export type Segmentos = Record<string, { hogares: number; con_permiso: number }>;

export const SEGMENTOS: { valor: string; texto: string }[] = [
  { valor: "todos", texto: "Todos los hogares" },
  { valor: "gratis", texto: "Hogares en Gratis" },
  { valor: "familia", texto: "Hogares en Familia" },
  { valor: "prueba", texto: "Probando Familia" },
  { valor: "mora", texto: "Con el pago pendiente" },
  { valor: "inactivos", texto: "Sin movimientos hace 30 días" },
];

export const CONDICIONES_SEGMENTO: [string, string][] = [
  ["tope_dian", "Alguien del hogar pasó un tope DIAN"],
  ["presupuesto_excedido", "Una categoría pasó su presupuesto este mes"],
  ["fondo_atrasado", "El fondo de emergencia va atrasado"],
  ["sin_fondo", "No tiene fondo de emergencia"],
  ["varias_deudas", "Tiene más de una deuda"],
  ["un_miembro_14d", "Un solo miembro hace 14 días (sin pareja invitada)"],
  ["sin_registro_7d", "No registra nada en 7 días"],
];
