import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Cierre de sesión de la app. El proxy manda aquí tras los días sin uso de Ajustes de la plataforma (`?motivo=inactividad`). */
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  const destino = new URL("/ingresar", request.url);
  if (request.nextUrl.searchParams.get("motivo") === "inactividad") destino.searchParams.set("motivo", "inactividad");
  const r = NextResponse.redirect(destino);
  r.cookies.delete("mh_visita");
  return r;
}
