/** Rutas accesibles sin sesión. */
export const RUTAS_PUBLICAS = ["/ingresar", "/registro", "/recuperar", "/invitacion", "/auth", "/sin-conexion", "/mantenimiento", "/api/avisos", "/api/cobros", "/api/pagos", "/api/whatsapp", "/api/correos", "/dev/correos"];

export function esRutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));
}

/** Evita redirecciones abiertas: solo rutas internas. */
export function destinoSeguro(siguiente: string | null | undefined, porDefecto = "/"): string {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.startsWith("/\\")) {
    return porDefecto;
  }
  return siguiente;
}
