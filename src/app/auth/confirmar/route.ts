import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/rutas";

/** Destino del enlace de confirmación de correo (Supabase Cloud con confirmación activa). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const siguiente = destinoSeguro(searchParams.get("siguiente"), "/onboarding");

  if (token_hash && type) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(siguiente, request.url));
  }
  return NextResponse.redirect(new URL("/ingresar?error=confirmacion", request.url));
}
