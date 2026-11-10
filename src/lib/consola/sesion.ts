import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { MATRIZ, type Permiso, type RolStaff } from "./permisos";

/**
 * Cliente de Supabase para la consola: además de la sesión, manda la IP y el navegador de quien la usa
 * (`x-mh-ip`, `x-mh-agente`), que `private.auditar` guarda en cada registro de auditoría.
 */
export async function crearClienteConsola() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const agente = (h.get("user-agent") ?? "").replace(/[^\x20-\x7e]/g, "").slice(0, 300);
  return crearClienteServidor({ ...(ip && { "x-mh-ip": ip }), ...(agente && { "x-mh-agente": agente }) });
}

export type Staff = {
  supabase: Awaited<ReturnType<typeof crearClienteConsola>>;
  userId: string;
  email: string;
  nombre: string;
  rol: RolStaff;
  puede: (p: Permiso) => boolean;
};

/**
 * Capa de acceso de la consola (una vez por request). El proxy ya hizo el chequeo optimista con el JWT; aquí se
 * lee la fila propia de `platform_staff` para que desactivar a alguien corte su acceso en el siguiente clic, sin
 * esperar a que venza el token. La autorización real la hacen las funciones `consola_*` en la base.
 */
export const obtenerStaff = cache(async (): Promise<Staff> => {
  const supabase = await crearClienteConsola();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/consola/ingresar");
  if (claims.aal !== "aal2") redirect("/consola/ingresar");

  const { data: fila } = await supabase.from("platform_staff").select("nombre, rol, activo").eq("user_id", claims.sub).maybeSingle();
  if (!fila?.activo) redirect("/");

  return {
    supabase,
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    nombre: fila.nombre,
    rol: fila.rol,
    puede: (p) => MATRIZ[fila.rol].includes(p),
  };
});
