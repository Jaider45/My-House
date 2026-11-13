import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Clic en una recomendación de la Academia: se cuenta (consola → Academia → Recomendaciones) y abre la lección. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await supabase.rpc("clic_recomendacion", { p_id: id }) : { data: null };
  const destino = typeof data === "string" && data.startsWith("/academia/") ? data : "/academia";
  return NextResponse.redirect(new URL(destino, request.nextUrl.origin), 303);
}
