import { after, NextResponse, type NextRequest } from "next/server";
import { configWompi, describirMetodo, eventoValido, type EventoWompi } from "@/lib/pagos/wompi";
import { avisarAdministradores, crearClienteServicio } from "@/lib/pagos/servidor";
import { correoPagoRecibido } from "@/lib/correo/correos";
import { sitio } from "@/lib/correo/enviar";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaCorta } from "@/lib/consola/formato";

/**
 * Eventos de Wompi (URL de eventos configurada en el panel de Wompi). Se verifica el checksum con
 * WOMPI_EVENTS_SECRET; la base procesa cada evento una sola vez y solo da por pagado un cobro con el monto exacto.
 * Wompi reintenta mientras no respondamos 200: los errores de la base responden 500 a propósito.
 */
export async function POST(request: NextRequest) {
  const config = configWompi();
  if (!config) return NextResponse.json({ error: "Pagos no configurados" }, { status: 503 });

  let evento: EventoWompi;
  try {
    evento = (await request.json()) as EventoWompi;
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (!eventoValido(evento, config.eventos)) return NextResponse.json({ error: "Firma no válida" }, { status: 401 });

  const t = evento.data?.transaction;
  if (evento.event !== "transaction.updated" || !t?.reference) return NextResponse.json({ resultado: "ignorado" });

  const db = crearClienteServicio();
  const { metodo, detalle } = describirMetodo(t);
  const { data, error } = await db.rpc("registrar_pago_wompi", {
    p_evento: `${t.id}:${t.status}`,
    p_referencia: t.reference,
    p_transaccion: t.id,
    p_estado: t.status,
    p_monto_centavos: t.amount_in_cents,
    p_metodo: metodo,
    p_detalle: detalle ?? "",
    p_payload: evento as unknown as Record<string, never>,
  });
  if (error) {
    console.error("[wompi]", error.message);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }

  const r = data as { resultado: string; hogar?: string; plan?: string; periodo?: string; monto?: number; referencia?: string };
  if (r.resultado === "aplicado" && r.hogar) {
    const hogar = r.hogar;
    // El correo sale después de responder: Wompi no espera por él.
    after(async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        db.from("suscripciones").select("vence").eq("household_id", hogar).single(),
        db.from("planes").select("nombre").eq("codigo", r.plan!).single(),
      ]);
      await avisarAdministradores(db, hogar, "pago-recibido", (a) =>
        correoPagoRecibido({
          nombre: a.nombre,
          hogar: a.hogar,
          plan: p?.nombre ?? "Familia",
          periodo: r.periodo === "anual" ? "anual" : "mensual",
          monto: formatearCOP(r.monto ?? 0),
          hasta: formatearFechaCorta(s ? `${s.vence}T12:00:00-05:00` : null),
          metodo: [metodo, detalle].filter(Boolean).join(" ") || null,
          referencia: r.referencia ?? t.reference,
          urlPlan: `${sitio()}/ajustes/plan`,
          sitio: sitio(),
        }),
      );
    });
  }
  return NextResponse.json({ resultado: r.resultado });
}
