import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esRutaPublica } from "@/lib/rutas";

/**
 * Refresca la sesión de Supabase en cada request y hace los chequeos optimistas:
 * sin sesión → /ingresar; con 2FA activa pero sin verificar en esta sesión → /mfa.
 * La autorización real la hace RLS en la base de datos.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista, cabeceras) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
          Object.entries(cabeceras ?? {}).forEach(([k, v]) => respuesta.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const ruta = request.nextUrl.pathname;
  const redirigir = (destino: string, conSiguiente = false) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = conSiguiente ? `?siguiente=${encodeURIComponent(ruta + request.nextUrl.search)}` : "";
    const r = NextResponse.redirect(url);
    respuesta.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!data?.claims) {
    return esRutaPublica(ruta) ? respuesta : redirigir("/ingresar", ruta !== "/");
  }

  if (ruta !== "/mfa" && ruta !== "/salir") {
    // El JWT trae `mfa_activa` (custom_access_token_hook) y `aal`: no hace falta consultar a Auth en cada request.
    // Tokens emitidos antes de la migración no lo traen: para esos se pregunta como antes.
    const { mfa_activa, aal } = data.claims as { mfa_activa?: boolean; aal?: string };
    const exigir =
      typeof mfa_activa === "boolean"
        ? mfa_activa && aal !== "aal2"
        : await supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: n }) => n?.nextLevel === "aal2" && n.currentLevel !== "aal2");
    if (exigir) {
      return redirigir("/mfa", ruta !== "/");
    }
  }

  if (ruta === "/ingresar" || ruta === "/registro" || ruta === "/recuperar") {
    return redirigir("/");
  }
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|iconos/|.*\.(?:png|svg|ico|webp)$).*)"],
};
