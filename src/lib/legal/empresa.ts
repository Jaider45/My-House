import { RESPONSABLE } from "./responsable";

/** Ajustes de la plataforma → Empresa (`plataforma_config.empresa`). Módulo liviano: sin servidor. */
export type Empresa = {
  razon_social?: string;
  nit?: string;
  correo_contacto?: string;
  responsable?: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string;
  correo_datos?: string;
  correo_soporte?: string;
};

const lleno = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Variables de los textos legales: lo de la consola o, si está vacío, lo del código (con [marcadores]). */
export function variablesEmpresa(e: Empresa): Record<string, string> {
  const ciudad = lleno(e.ciudad);
  const direccion = lleno(e.direccion);
  return {
    razon_social: lleno(e.razon_social) ?? RESPONSABLE.nombre,
    nit: lleno(e.nit) ?? RESPONSABLE.identificacion,
    identificacion: lleno(e.nit) ? `NIT ${e.nit!.trim()}` : RESPONSABLE.identificacion,
    direccion: direccion ? (ciudad ? `${direccion}, ${ciudad}` : direccion) : RESPONSABLE.direccion,
    ciudad: ciudad ?? "Bogotá, Colombia",
    telefono: lleno(e.telefono) ?? RESPONSABLE.telefono,
    correo_datos: lleno(e.correo_datos) ?? RESPONSABLE.correoDatos,
    correo_soporte: lleno(e.correo_soporte) ?? RESPONSABLE.correoSoporte,
    correo_contacto: lleno(e.correo_contacto) ?? RESPONSABLE.correoSoporte,
    responsable: lleno(e.responsable) ?? lleno(e.razon_social) ?? RESPONSABLE.nombre,
    sitio: RESPONSABLE.sitio,
  };
}

/** Campos que aún tienen [marcador]: las páginas legales muestran «Borrador». */
export function camposPendientes(variables: Record<string, string>): string[] {
  return ["razon_social", "identificacion", "direccion", "telefono"].filter((k) => variables[k]?.includes("["));
}
