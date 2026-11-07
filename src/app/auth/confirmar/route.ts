import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/rutas";
import { avisarSiDispositivoNuevo } from "@/lib/correo/acceso";

/**
 * Destino del enlace de confirmación de correo (Supabase Cloud con confirmación activa).
 * Acepta el flujo PKCE (?code=, el de @supabase/ssr) y el de plantilla con token_hash.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const siguiente = destinoSeguro(searchParams.get("siguiente"), "/onboarding");

  const supabase = await crearClienteServidor();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : token_hash && type
      ? await supabase.auth.verifyOtp({ token_hash, type })
      : { error: new Error("Enlace incompleto") };

  if (!error) {
    // La recuperación la acaba de pedir la persona: no hace falta el «¿Fuiste tú?».
    if (siguiente !== "/nueva-contrasena") await avisarSiDispositivoNuevo(supabase);
    return NextResponse.redirect(new URL(siguiente, request.url));
  }
  return NextResponse.redirect(new URL("/ingresar?error=confirmacion", request.url));
}
