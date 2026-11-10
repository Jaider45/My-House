import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esRutaPublica } from "@/lib/rutas";
import { COOKIE_ACTIVIDAD, MINUTOS_INACTIVIDAD, opcionesCookieActividad, type ClaimStaff } from "@/lib/consola/permisos";

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

  // De dónde llegó la persona (pauta o enlace de referido de un contador): queda en cookies hasta crear el hogar.
  const utm = request.nextUrl.searchParams.get("utm_source");
  const ref = request.nextUrl.searchParams.get("ref");
  const cookieCanal = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" } as const;
  if (utm && /^[\w-]{1,40}$/.test(utm) && !request.cookies.get("mh_canal")) respuesta.cookies.set("mh_canal", utm.toLowerCase(), cookieCanal);
  if (ref && /^[a-z0-9]{6,12}$/i.test(ref)) respuesta.cookies.set("mh_ref", ref.toUpperCase(), cookieCanal);

  const redirigir = (destino: string, conSiguiente = false) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = conSiguiente ? `?siguiente=${encodeURIComponent(ruta + request.nextUrl.search)}` : "";
    const r = NextResponse.redirect(url);
    respuesta.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (ruta === "/consola" || ruta.startsWith("/consola/")) {
    return consola(request, respuesta, redirigir, data?.claims);
  }

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

type Claims = { staff?: ClaimStaff; aal?: string; mfa_activa?: boolean };

/**
 * Consola del equipo (/consola). Chequeo optimista con el JWT; la base exige lo mismo en cada función.
 * - Sin sesión: solo el ingreso, la invitación y salir.
 * - Con sesión pero fuera del equipo: solo el ingreso (que lo explica) y la invitación.
 * - Del equipo sin AAL2: al código (si tiene 2FA) o a activarla (si no). La 2FA es obligatoria para el equipo.
 * - Con AAL2: adentro, con cierre de sesión tras MINUTOS_INACTIVIDAD sin abrir ninguna pantalla de la consola.
 */
function consola(request: NextRequest, respuesta: NextResponse, redirigir: (destino: string, conSiguiente?: boolean) => NextResponse, claims?: Claims) {
  const ruta = request.nextUrl.pathname;
  const libre = ruta.startsWith("/consola/invitacion/") || ruta === "/consola/salir";
  if (!claims) return libre || ruta === "/consola/ingresar" ? respuesta : redirigir("/consola/ingresar", ruta !== "/consola");
  if (libre) return respuesta;
  if (!claims.staff) return ruta === "/consola/ingresar" ? respuesta : redirigir("/");

  if (claims.aal !== "aal2") {
    const destino = claims.mfa_activa ? "/consola/ingresar" : "/consola/dos-pasos";
    return ruta === destino ? respuesta : redirigir(destino, ruta !== "/consola");
  }
  if (ruta === "/consola/ingresar" || ruta === "/consola/dos-pasos") return redirigir("/consola");

  const ultima = Number(request.cookies.get(COOKIE_ACTIVIDAD)?.value);
  if (ultima && Date.now() - ultima > MINUTOS_INACTIVIDAD * 60_000) {
    const url = request.nextUrl.clone();
    url.pathname = "/consola/salir";
    url.search = "?motivo=inactividad";
    return NextResponse.redirect(url);
  }
  respuesta.cookies.set(COOKIE_ACTIVIDAD, String(Date.now()), opcionesCookieActividad);
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sw.js|iconos/|.*\.(?:png|svg|ico|webp)$).*)"],
};
