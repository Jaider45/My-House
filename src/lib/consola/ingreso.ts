import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { crearClienteConsola } from "./sesion";
import { COOKIE_ACTIVIDAD, opcionesCookieActividad } from "./permisos";
import { destinoConsola } from "./rutas";

/**
 * Último paso de todo ingreso a la consola (código o activación de 2FA), ya con AAL2: lo registra en la auditoría,
 * arranca de cero el contador de inactividad (para no heredar una cookie vieja) y entra. Si la base no acepta el
 * registro (persona desactivada en el intermedio), cierra la sesión.
 */
export async function entrar(supabase: Awaited<ReturnType<typeof crearClienteConsola>>, siguiente: FormDataEntryValue | null): Promise<never> {
  const { error } = await supabase.rpc("consola_registrar_ingreso");
  if (error) {
    await supabase.auth.signOut();
    redirect("/consola/ingresar");
  }
  (await cookies()).set(COOKIE_ACTIVIDAD, String(Date.now()), opcionesCookieActividad);
  redirect(destinoConsola(siguiente));
}
