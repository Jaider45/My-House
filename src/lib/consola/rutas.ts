import { destinoSeguro } from "@/lib/rutas";

/** Destino tras ingresar a la consola: solo rutas internas de /consola (evita redirecciones abiertas). */
export function destinoConsola(siguiente: unknown): string {
  const d = destinoSeguro(typeof siguiente === "string" ? siguiente : null, "/consola");
  return d === "/consola" || d.startsWith("/consola/") || d.startsWith("/consola?") ? d : "/consola";
}
