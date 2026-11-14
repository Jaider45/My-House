/**
 * Usos de WhatsApp de la plataforma (Ajustes de la plataforma → WhatsApp): qué plantilla aprobada sale en cada
 * caso y qué variable va en cada {{n}}. Puro y liviano (lo usan la consola y el envío).
 */

export type UsoWhatsapp = "aviso_equipo" | "cobro_mora" | "cobro_renovacion" | "cobro_gratis";
export type Uso = { plantilla: string; variables: string[] };
export type UsosWhatsapp = Record<UsoWhatsapp, Uso>;

export const USOS: { clave: UsoWhatsapp; nombre: string; cuando: string; disponibles: { clave: string; texto: string }[] }[] = [
  {
    clave: "aviso_equipo",
    nombre: "Aviso al equipo",
    cuando: "Los avisos para el equipo que tengan WhatsApp activo",
    disponibles: [
      { clave: "titulo", texto: "Título del aviso" },
      { clave: "texto", texto: "Detalle del aviso" },
    ],
  },
  {
    clave: "cobro_mora",
    nombre: "Pago del plan fallido",
    cuando: "Cada reintento de cobro en mora, a los administradores del hogar",
    disponibles: [
      { clave: "nombre", texto: "Nombre de la persona" },
      { clave: "plan", texto: "Plan" },
      { clave: "monto", texto: "Monto pendiente" },
      { clave: "baja", texto: "Fecha del paso a Gratis" },
    ],
  },
  {
    clave: "cobro_renovacion",
    nombre: "Renovación próxima",
    cuando: "3 días antes de renovar el plan",
    disponibles: [
      { clave: "nombre", texto: "Nombre de la persona" },
      { clave: "plan", texto: "Plan" },
      { clave: "monto", texto: "Monto" },
      { clave: "vence", texto: "Fecha de renovación" },
    ],
  },
  {
    clave: "cobro_gratis",
    nombre: "Pasó a Gratis",
    cuando: "Cuando el hogar pasa a Gratis por mora o cancelación",
    disponibles: [
      { clave: "nombre", texto: "Nombre de la persona" },
      { clave: "plan", texto: "Plan anterior" },
    ],
  },
];

export const USOS_POR_DEFECTO: UsosWhatsapp = {
  aviso_equipo: { plantilla: "", variables: ["titulo", "texto"] },
  cobro_mora: { plantilla: "", variables: ["nombre", "plan", "monto", "baja"] },
  cobro_renovacion: { plantilla: "", variables: ["nombre", "plan", "monto", "vence"] },
  cobro_gratis: { plantilla: "", variables: ["nombre", "plan"] },
};

/** Variables de las campañas por WhatsApp (las mismas del editor de correos). */
export const VARIABLES_CAMPANA = [
  { clave: "nombre", texto: "Nombre de la persona" },
  { clave: "hogar", texto: "Nombre del hogar" },
  { clave: "plan", texto: "Plan" },
  { clave: "minimo", texto: "Número mínimo" },
  { clave: "fecha_pago", texto: "Próxima fecha de pago" },
];

/** Parámetros de la plantilla en el orden {{1}}, {{2}}… (texto plano, sin saltos: Meta los rechaza). */
export function parametrosDeUso(u: Uso, vars: Record<string, string | undefined>): string[] {
  return u.variables.map((v) => (vars[v] ?? "").replace(/\s*\n+\s*/g, " ").trim().slice(0, 900));
}

/** Cuántas variables distintas ({{n}}) tiene el cuerpo de una plantilla. */
export const cantidadVariables = (cuerpo: string) => new Set([...cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;

/** ¿Se puede enviar marketing ahora? Horario de Bogotá y, si se pidió, nunca en domingo. */
export function dentroDelHorario(ahora: Date, e: { wa_desde: string; wa_hasta: string; wa_sin_marketing_domingo: boolean }): boolean {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ahora);
  const dia = partes.find((p) => p.type === "weekday")?.value;
  const hora = `${partes.find((p) => p.type === "hour")?.value}:${partes.find((p) => p.type === "minute")?.value}`;
  if (e.wa_sin_marketing_domingo && dia === "Sun") return false;
  return hora >= e.wa_desde && hora < e.wa_hasta;
}
