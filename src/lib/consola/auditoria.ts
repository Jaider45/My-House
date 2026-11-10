import { nombreRol, type RolStaff } from "./permisos";

export type Registro = { accion: string; objeto_nombre: string | null; detalle: unknown };

const rol = (v: unknown) => (typeof v === "string" ? nombreRol(v as RolStaff) : "");

/** Frase de cada acción de la auditoría, como en el diseño («Cambió el precio anual de Familia»). */
export function describirAccion({ accion, objeto_nombre, detalle }: Registro): string {
  const d = (detalle && typeof detalle === "object" ? detalle : {}) as Record<string, unknown>;
  const quien = objeto_nombre ?? "una persona";
  switch (accion) {
    case "ingreso_consola":
      return "Ingresó a la consola";
    case "invito_persona":
      return `Invitó a ${quien} como ${rol(d.rol)}`;
    case "cancelo_invitacion":
      return `Canceló la invitación de ${quien}`;
    case "acepto_invitacion":
      return `Aceptó la invitación como ${rol(d.rol)}`;
    case "cambio_rol":
      return `Cambió el rol de ${quien}: ${rol(d.antes)} → ${rol(d.despues)}`;
    case "desactivo_persona":
      return `Desactivó el acceso de ${quien}`;
    case "reactivo_persona":
      return `Reactivó el acceso de ${quien}`;
    case "exporto_auditoria":
      return "Exportó el registro de auditoría";
    case "superadmin_creado":
      return `Dio acceso de superadmin a ${quien}`;
    default:
      return accion.replace(/_/g, " ");
  }
}

/** Celda CSV segura: comillas dobles y sin fórmulas (Excel ejecuta celdas que empiezan con = + - @). */
export function celdaCsv(valor: unknown): string {
  let s = valor === null || valor === undefined ? "" : typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
