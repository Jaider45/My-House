import { formatearCOP } from "@/lib/dinero";
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
    case "cambio_plan":
      return `Cambió el plan de ${quien}: ${d.antes} → ${d.despues}${d.motivo ? ` (${d.motivo})` : ""}`;
    case "suspendio_hogar":
      return `Suspendió ${quien}${d.motivo ? ` (${d.motivo})` : ""}`;
    case "reactivo_hogar":
      return `Reactivó ${quien}`;
    case "vio_correo":
      return `Vio el correo completo de ${quien}`;
    case "cerro_sesiones":
      return `Cerró las sesiones de ${quien}`;
    case "restablecio_2fa":
      return `Restableció la verificación en dos pasos de ${quien}`;
    case "edito_plan":
      return `Editó el plan ${quien}`;
    case "edito_regla":
      return `Cambió la regla de cobro ${quien}`;
    case "reembolso":
      return `Registró un reembolso de ${formatearCOP(Number(d.monto ?? 0))} a ${quien}`;
    case "creo_cupon":
      return `Creó el cupón ${quien}`;
    case "edito_cupon":
      return `Editó el cupón ${quien}`;
    case "conecto_integracion":
      return `Conectó la integración ${quien}`;
    case "edito_integracion":
      return `Cambió la integración ${quien}${Array.isArray(d.secretos_cambiados) && d.secretos_cambiados.length ? ` (secretos: ${d.secretos_cambiados.join(", ")})` : ""}`;
    case "desconecto_integracion":
      return `Desconectó la integración ${quien}`;
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
