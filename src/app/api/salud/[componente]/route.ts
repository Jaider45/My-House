import { after, connection, NextResponse } from "next/server";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";
import { chequear, esComponente } from "@/lib/salud";

/*
 * Salud de un componente para la página de estado (Better Stack): 200 operativo, 503 falla, 404 si no existe.
 * Pública y sin detalles; el motivo de una falla queda en el log del servidor.
 */
export async function GET(_: Request, { params }: { params: Promise<{ componente: string }> }) {
  await connection();
  const { componente } = await params;
  if (!esComponente(componente)) return NextResponse.json({ error: "Componente desconocido" }, { status: 404 });
  const inicio = Date.now();
  const r = await chequear(componente);
  const ms = Date.now() - inicio;
  if (!r.ok) console.error(`[salud] ${componente}: ${r.motivo}`);
  // Historial para Consola → Estado del sistema (disponibilidad de 30 días y latencia).
  if (hayServicio())
    after(async () => {
      await crearClienteServicio().rpc("salud_registrar", { p_componente: componente, p_ok: r.ok, p_ms: ms });
    });
  return NextResponse.json(
    { componente, estado: r.ok ? "operativo" : "falla" },
    { status: r.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
