import { connection, NextResponse } from "next/server";
import { chequear, esComponente } from "@/lib/salud";

/*
 * Salud de un componente para la página de estado (Better Stack): 200 operativo, 503 falla, 404 si no existe.
 * Pública y sin detalles; el motivo de una falla queda en el log del servidor.
 */
export async function GET(_: Request, { params }: { params: Promise<{ componente: string }> }) {
  await connection();
  const { componente } = await params;
  if (!esComponente(componente)) return NextResponse.json({ error: "Componente desconocido" }, { status: 404 });
  const r = await chequear(componente);
  if (!r.ok) console.error(`[salud] ${componente}: ${r.motivo}`);
  return NextResponse.json(
    { componente, estado: r.ok ? "operativo" : "falla" },
    { status: r.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
