import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { COOKIE_ACTIVIDAD } from "@/lib/consola/permisos";

/** Cierre de sesión de la consola. El proxy manda aquí tras 30 minutos sin actividad (`?motivo=inactividad`). */
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  const destino = new URL("/consola/ingresar", request.url);
  if (request.nextUrl.searchParams.get("motivo") === "inactividad") destino.searchParams.set("motivo", "inactividad");
  const r = NextResponse.redirect(destino);
  r.cookies.delete({ name: COOKIE_ACTIVIDAD, path: "/consola" });
  return r;
}
