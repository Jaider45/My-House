/**
 * Textos editables de los correos automáticos (Consola → Correos y campañas → Correos automáticos). El equipo puede
 * reescribir el asunto, la vista previa, el título, la introducción, la nota y el texto del botón principal; las
 * tarjetas con cifras y los enlaces siguen saliendo del código. `{variable}` se reemplaza con los datos de cada
 * envío (los que el constructor del correo pone en `contenido.variables`). Puro y liviano.
 */
import type { Contenido } from "./plantilla";

export type CampoTexto = "asunto" | "vista_previa" | "titulo" | "intro" | "nota" | "boton";
export type TextosCorreo = Partial<Record<CampoTexto, string>>;

export const CAMPOS: { clave: CampoTexto; texto: string; largo?: boolean }[] = [
  { clave: "asunto", texto: "Asunto" },
  { clave: "vista_previa", texto: "Vista previa (lo que se ve en el buzón)" },
  { clave: "titulo", texto: "Título" },
  { clave: "intro", texto: "Introducción", largo: true },
  { clave: "nota", texto: "Nota", largo: true },
  { clave: "boton", texto: "Texto del botón principal" },
];

/** Correos editables: clave de textos → muestra para la vista previa. */
export const EDITABLES: { clave: string; nombre: string; muestra: string }[] = [
  { clave: "bienvenida", nombre: "Bienvenida", muestra: "bienvenida" },
  { clave: "recordatorio", nombre: "Recordatorio", muestra: "recordatorio" },
  { clave: "proximo", nombre: "Pago fijo por vencer", muestra: "recordatorio" },
  { clave: "vencido", nombre: "Pago vencido", muestra: "vencido" },
  { clave: "resumen", nombre: "Resumen semanal", muestra: "resumen" },
  { clave: "dian", nombre: "Aviso Renta DIAN", muestra: "dian" },
  { clave: "plazo", nombre: "Fecha de declarar renta", muestra: "plazo" },
  { clave: "cobro-renovacion", nombre: "Renovación del plan", muestra: "renovacion" },
  { clave: "cobro-mora", nombre: "Pago del plan pendiente", muestra: "mora" },
  { clave: "cobro-gratis", nombre: "Pasó a Gratis por mora", muestra: "plan-gratis" },
  { clave: "cobro-cancelada", nombre: "Pasó a Gratis al cancelar", muestra: "plan-gratis" },
  { clave: "cobro-prueba", nombre: "La prueba termina", muestra: "prueba-termina" },
  { clave: "pago-recibido", nombre: "Pago recibido", muestra: "pago-recibido" },
  { clave: "seguridad", nombre: "Nuevo inicio de sesión", muestra: "seguridad" },
];

/** Reemplaza {variable}; una variable desconocida queda tal cual (así se nota en la vista previa). */
export const reemplazar = (t: string, vars: Record<string, string>) => t.replace(/\{([a-z_]+)\}/g, (m, k: string) => vars[k] ?? m);

/** Aplica los textos editados (los campos vacíos conservan el texto del código). */
export function aplicarTextos(c: Contenido, t: TextosCorreo | undefined): Contenido {
  if (!t) return c;
  const v = c.variables ?? {};
  const r = (k: CampoTexto) => (t[k]?.trim() ? reemplazar(t[k]!.trim(), v) : null);
  const boton = r("boton");
  return {
    ...c,
    asunto: r("asunto") ?? c.asunto,
    vistaPrevia: r("vista_previa") ?? c.vistaPrevia,
    titulo: r("titulo") ?? c.titulo,
    intro: r("intro") ?? c.intro,
    nota: r("nota") ? { ...(c.nota ?? {}), texto: r("nota")! } : c.nota,
    botones: boton && c.botones ? ([{ ...c.botones[0], texto: boton }, ...c.botones.slice(1)] as Contenido["botones"]) : c.botones,
  };
}
