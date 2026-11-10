import { after, NextResponse, type NextRequest } from "next/server";
import { estadoDeEvento, estadoQueQueda, firmaSvixValida } from "@/lib/correo/eventos";
import { leerIntegracion, registrarEvento } from "@/lib/integraciones/servidor";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";

/**
 * Webhook de Resend (Integraciones → Correo, campo «Secreto del webhook»): actualiza el estado de cada correo en
 * correos_enviados (entregado, abierto, clic, rebote). Sin el secreto configurado responde 503 y no procesa nada.
 */
export async function POST(request: NextRequest) {
  const resend = await leerIntegracion("resend");
  const secreto = resend?.valores.webhook_secret;
  if (!secreto || !hayServicio()) return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });

  const cuerpo = await request.text();
  if (cuerpo.length > 100_000) return NextResponse.json({ error: "Demasiado grande" }, { status: 413 });
  const valida = firmaSvixValida(
    cuerpo,
    { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), firma: request.headers.get("svix-signature") },
    secreto,
  );
  if (!valida) return NextResponse.json({ error: "Firma no válida" }, { status: 401 });

  let evento: { type?: string; data?: { email_id?: string } };
  try {
    evento = JSON.parse(cuerpo) as typeof evento;
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  const nuevo = estadoDeEvento(evento.type ?? "");
  const id = evento.data?.email_id;
  if (!nuevo || !id) return NextResponse.json({ resultado: "ignorado" });

  const db = crearClienteServicio();
  const { data: fila } = await db.from("correos_enviados").select("id, estado").eq("resend_id", id).maybeSingle();
  if (fila) {
    const estado = estadoQueQueda(fila.estado, nuevo);
    if (estado) await db.from("correos_enviados").update({ estado, actualizado: new Date().toISOString() }).eq("id", fila.id);
  }
  after(() => registrarEvento("resend"));
  return NextResponse.json({ resultado: fila ? "actualizado" : "desconocido" });
}
