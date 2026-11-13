import { after, NextResponse, type NextRequest } from "next/server";
import { eventoValido, type EventoWompi } from "@/lib/pagos/wompi";
import { crearClienteServicio, obtenerWompi, procesarTransaccion } from "@/lib/pagos/servidor";
import { registrarEvento } from "@/lib/integraciones/servidor";

/**
 * Eventos de Wompi (URL de eventos configurada en el panel de Wompi). Se verifica el checksum con
 * WOMPI_EVENTS_SECRET; la base procesa cada evento una sola vez y solo da por pagado un cobro con el monto exacto.
 * Wompi reintenta mientras no respondamos 200: los errores de la base responden 500 a propósito.
 */
export async function POST(request: NextRequest) {
  const config = await obtenerWompi();
  if (!config) return NextResponse.json({ error: "Pagos no configurados" }, { status: 503 });

  let evento: EventoWompi;
  try {
    evento = (await request.json()) as EventoWompi;
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (!eventoValido(evento, config.eventos)) return NextResponse.json({ error: "Firma no válida" }, { status: 401 });

  after(() => registrarEvento("wompi"));
  const t = evento.data?.transaction;
  if (evento.event !== "transaction.updated" || !t?.reference) return NextResponse.json({ resultado: "ignorado" });

  const r = await procesarTransaccion(crearClienteServicio(), t, evento);
  if ("error" in r) {
    console.error("[wompi]", r.error);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
  return NextResponse.json({ resultado: r.resultado });
}
