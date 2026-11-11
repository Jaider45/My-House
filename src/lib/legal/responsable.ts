/**
 * Datos legales de My House: quién es el Responsable del tratamiento (Ley 1581 de 2012) y la versión vigente de los
 * textos. Módulo liviano (lo importan páginas y componentes de cliente).
 *
 * ⚠️ Antes de abrir el registro al público: reemplaza todo lo que está entre [CORCHETES]. Mientras falte algo
 * (`PENDIENTES`), /terminos y /privacidad muestran un aviso de borrador.
 *
 * Cambiar `VERSION_LEGAL` (fecha AAAA-MM-DD) cuando cambien los términos o la política de forma sustancial: las
 * casillas se vuelven a pedir al crear un hogar o aceptar una invitación. Para quien ya está dentro de la app aún no
 * hay pantalla que las pida de nuevo (se le avisa por correo).
 */

export const VERSION_LEGAL = "2026-11-11";

export const RESPONSABLE = {
  /** Nombre completo (persona natural) o razón social (sociedad). */
  nombre: "[NOMBRE O RAZÓN SOCIAL]",
  /** «C.C. 1.234.567.890» o «NIT 901.234.567-8». */
  identificacion: "[C.C. O NIT]",
  direccion: "[DIRECCIÓN], [CIUDAD], Colombia",
  telefono: "[TELÉFONO]",
  /** Canal para consultas y reclamos de los titulares (Ley 1581). */
  correoDatos: "datos@myhousecol.co",
  /** Soporte general. */
  correoSoporte: "soporte@myhousecol.co",
  sitio: "myhousecol.co",
} as const;

/** Campos que aún tienen marcador. */
export const PENDIENTES = Object.entries(RESPONSABLE)
  .filter(([, v]) => v.includes("["))
  .map(([k]) => k);

/** «11 de noviembre de 2026». */
export function fechaVersion(version = VERSION_LEGAL): string {
  const [a, m, d] = version.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d)),
  );
}
