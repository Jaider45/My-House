/**
 * Nombre para prellenar formularios: el que se escribió al registrarse (`nombre`) o el que manda Google
 * (`full_name` / `name`). Solo el primer nombre si viene completo de Google.
 */
export function nombreDe(metadatos: Record<string, unknown> | null | undefined): string {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const propio = texto(metadatos?.nombre);
  if (propio) return propio;
  const google = texto(metadatos?.full_name) || texto(metadatos?.name);
  return google.split(/\s+/)[0] ?? "";
}
