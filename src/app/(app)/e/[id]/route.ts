import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Clic en un enlace de interés: se cuenta (clics de 30 días en la consola) y se abre el destino. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await supabase.rpc("clic_enlace", { p_id: id }) : { data: null };
  const destino = typeof data === "string" && /^(https:\/\/|\/(?!\/))/.test(data) ? data : "/";
  return NextResponse.redirect(new URL(destino, request.nextUrl.origin), 303);
}
