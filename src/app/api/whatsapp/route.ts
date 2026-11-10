import { after, NextResponse, type NextRequest } from "next/server";
import { firmaWhatsappValida, leerIntegracion, registrarEvento } from "@/lib/integraciones/servidor";

/*
 * Webhook de WhatsApp Business (Meta). La URL y el token de verificación se copian de la consola (Integraciones).
 * GET: Meta verifica la suscripción con hub.verify_token. POST: mensajes y estados, firmados con el secreto de la app
 * (X-Hub-Signature-256). Por ahora solo se registra que llegan (estado de la integración); registrar gastos por
 * WhatsApp es una fase aparte.
 */

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const w = await leerIntegracion("whatsapp");
  const esperado = w?.valores.verify_token;
  if (p.get("hub.mode") === "subscribe" && esperado && p.get("hub.verify_token") === esperado) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("Token de verificación no válido", { status: 403 });
}

export async function POST(request: NextRequest) {
  const w = await leerIntegracion("whatsapp");
  if (!w?.valores.app_secret) return NextResponse.json({ error: "WhatsApp no está conectado" }, { status: 503 });
  const cuerpo = await request.text();
  if (cuerpo.length > 1_000_000) return NextResponse.json({ error: "Demasiado grande" }, { status: 413 });
  if (!firmaWhatsappValida(cuerpo, request.headers.get("x-hub-signature-256"), w.valores.app_secret)) {
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }
  after(() => registrarEvento("whatsapp"));
  return NextResponse.json({ recibido: true });
}
