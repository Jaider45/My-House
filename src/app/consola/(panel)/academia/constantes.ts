/** Opciones de las recomendaciones (las usan la página de servidor y los formularios de cliente). */

export const CONDICIONES: [string, string][] = [
  ["presupuesto_excedido", "Una categoría pasa su presupuesto"],
  ["tope_dian", "Alguien pasa un tope DIAN"],
  ["fondo_atrasado", "El fondo de emergencia va atrasado"],
  ["sin_fondo", "No tiene fondo de emergencia"],
  ["varias_deudas", "Tiene más de una deuda"],
  ["un_miembro_14d", "Hogar con un solo miembro por 14 días"],
  ["sin_registro_7d", "No registra nada en 7 días"],
  ["siempre", "Siempre (para empezar)"],
];
export const LUGARES: [string, string][] = [
  ["academia", "Academia"],
  ["inicio", "Inicio"],
  ["presupuesto", "Presupuesto"],
  ["renta", "Renta DIAN"],
  ["metas", "Metas"],
];
