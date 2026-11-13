import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Clic en una oferta: se cuenta en la base y se va al destino (ruta interna o https). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await supabase.rpc("clic_oferta", { p_id: id }) : { data: null };
  const destino = typeof data === "string" && /^(https:\/\/|\/(?!\/))/.test(data) ? data : "/";
  return NextResponse.redirect(new URL(destino, request.nextUrl.origin), 303);
}
