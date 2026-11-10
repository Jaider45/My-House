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
