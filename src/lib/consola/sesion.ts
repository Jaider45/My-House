import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { MATRIZ, nombreRol, type Permiso, type RolStaff } from "./permisos";

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
  /** Nombre del rol para mostrar: el fijo o el rol propio («Nuevo rol» en Equipo y permisos). */
  rolNombre: string;
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

  const { data: fila } = await supabase.from("platform_staff").select("nombre, rol, activo, rol_personal").eq("user_id", claims.sub).maybeSingle();
  if (!fila?.activo) redirect("/");
  // Rol propio: sus permisos están en la base (roles_staff); los fijos, en la matriz replicada.
  let permisos: Permiso[] = MATRIZ[fila.rol];
  let rolNombre = nombreRol(fila.rol);
  if (fila.rol_personal) {
    const { data: propio } = await supabase.rpc("mis_permisos_staff");
    const p = propio as { permisos?: Permiso[]; rol_nombre?: string | null } | null;
    permisos = p?.permisos ?? [];
    rolNombre = p?.rol_nombre ?? rolNombre;
  }

  return {
    supabase,
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    nombre: fila.nombre,
    rol: fila.rol,
    rolNombre,
    puede: (p) => permisos.includes(p),
  };
});
