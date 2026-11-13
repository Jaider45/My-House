/**
 * Correos automáticos (Consola → Correos y campañas → Correos automáticos). `etiquetas` = las que usa `enviarCorreo`
 * (y quedan en `correos_enviados`); `muestra` = clave de `muestras.ts` para la vista previa. Los que envía Supabase
 * (código, registro, restablecer) no pasan por la app: se cuentan aparte y no se apagan. Solo se pueden apagar los
 * que no son de seguridad ni de cobro. Liviano: lo usa la página y `enviarCorreo`.
 */

export type Automatico = { clave: string; nombre: string; cuando: string; etiquetas: string[]; muestra: string; envia: "app" | "supabase"; apagable: boolean };

export const AUTOMATICOS: Automatico[] = [
  { clave: "codigo", nombre: "Código de inicio de sesión", cuando: "Al pedir código", etiquetas: [], muestra: "codigo", envia: "supabase", apagable: false },
  { clave: "registro", nombre: "Confirmación de registro", cuando: "Al registrarse", etiquetas: [], muestra: "registro", envia: "supabase", apagable: false },
  { clave: "restablecer", nombre: "Restablecer contraseña", cuando: "Al pedir el enlace", etiquetas: [], muestra: "restablecer", envia: "supabase", apagable: false },
  { clave: "bienvenida", nombre: "Bienvenida", cuando: "Al terminar el onboarding", etiquetas: ["bienvenida"], muestra: "bienvenida", envia: "app", apagable: true },
  { clave: "recordatorio", nombre: "Recordatorio", cuando: "En los días que eligió el hogar", etiquetas: ["recordatorio"], muestra: "recordatorio", envia: "app", apagable: false },
  { clave: "proximo", nombre: "Pago fijo por vencer", cuando: "3 días antes del vencimiento", etiquetas: ["proximo"], muestra: "recordatorio", envia: "app", apagable: true },
  { clave: "vencido", nombre: "Pago vencido", cuando: "Al día siguiente", etiquetas: ["vencido"], muestra: "vencido", envia: "app", apagable: true },
  { clave: "resumen", nombre: "Resumen semanal", cuando: "Lunes · 7:00 a. m. (si el hogar lo activó)", etiquetas: ["resumen"], muestra: "resumen", envia: "app", apagable: true },
  { clave: "dian", nombre: "Aviso Renta DIAN", cuando: "Al cruzar un tope", etiquetas: ["dian"], muestra: "dian", envia: "app", apagable: true },
  { clave: "plazo", nombre: "Fecha de declarar renta", cuando: "60, 30 y 7 días antes (se cuenta con el aviso DIAN)", etiquetas: [], muestra: "plazo", envia: "app", apagable: false },
  { clave: "cobros", nombre: "Cobros del plan", cuando: "Renovación, mora, paso a Gratis y fin de la prueba", etiquetas: ["cobro-renovacion", "cobro-mora", "cobro-gratis", "cobro-cancelada", "cobro-prueba"], muestra: "renovacion", envia: "app", apagable: false },
  { clave: "pago", nombre: "Pago recibido", cuando: "Al aprobarse un pago", etiquetas: ["pago-recibido"], muestra: "pago-recibido", envia: "app", apagable: false },
  { clave: "seguridad", nombre: "Nuevo inicio de sesión", cuando: "Al entrar desde un navegador nuevo", etiquetas: ["seguridad"], muestra: "seguridad", envia: "app", apagable: false },
  { clave: "legal", nombre: "Nueva versión de una política", cuando: "10 días antes de que rija (Legal)", etiquetas: ["aviso-legal"], muestra: "campana", envia: "app", apagable: false },
];

/** Etiquetas de envío de un correo apagable (para `enviarCorreo`). */
export function etiquetaApagada(etiqueta: string | undefined, apagados: string[]): boolean {
  if (!etiqueta) return false;
  return AUTOMATICOS.some((a) => a.apagable && apagados.includes(a.clave) && a.etiquetas.includes(etiqueta));
}
