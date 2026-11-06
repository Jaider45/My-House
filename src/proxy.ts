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
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel?.nextLevel === "aal2" && nivel.currentLevel !== "aal2") {
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
