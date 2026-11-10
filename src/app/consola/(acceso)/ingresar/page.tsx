import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { ClaimStaff } from "@/lib/consola/permisos";
import { destinoConsola } from "@/lib/consola/rutas";
import { FueraDelEquipo, IngresoClave, IngresoCodigo } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

/**
 * Ingreso a la consola en dos pasos. El proxy ya mandó a /consola a quien tiene AAL2 y a /consola/dos-pasos a
 * quien es del equipo sin 2FA; aquí quedan tres casos: sin sesión, del equipo esperando el código, o una cuenta
 * de cliente.
 */
export default async function IngresarConsola({ searchParams }: PageProps<"/consola/ingresar">) {
  const sp = await searchParams;
  const siguiente = destinoConsola(sp.siguiente);
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { email?: string; staff?: ClaimStaff } | undefined;

  if (!claims) return <IngresoClave siguiente={siguiente} inactividad={sp.motivo === "inactividad"} />;
  if (!claims.staff) return <FueraDelEquipo email={claims.email ?? ""} />;
  return <IngresoCodigo email={claims.email ?? ""} siguiente={siguiente} />;
}
