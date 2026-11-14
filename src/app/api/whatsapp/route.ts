import { after, NextResponse, type NextRequest } from "next/server";
import { firmaWhatsappValida, leerIntegracion, registrarEvento } from "@/lib/integraciones/servidor";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";
import { avisarEquipo } from "@/lib/consola/avisos-equipo";
import { estadoDeMeta } from "@/lib/whatsapp/plantillas";

/*
 * Webhook de WhatsApp Business (Meta). La URL y el token de verificación se copian de la consola (Integraciones).
 * GET: Meta verifica la suscripción con hub.verify_token. POST: mensajes y estados, firmados con el secreto de la app
 * (X-Hub-Signature-256). Se registra que llegan (estado de la integración) y se actualiza el estado de las plantillas
 * (`message_template_status_update`); registrar gastos por WhatsApp es una fase aparte.
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
  after(async () => {
    await registrarEvento("whatsapp");
    await estadosDePlantillas(cuerpo);
    await estadosDeMensajes(cuerpo);
  });
  return NextResponse.json({ recibido: true });
}

type Cambio = { field?: string; value?: { event?: string; message_template_id?: number | string; message_template_name?: string; message_template_language?: string; reason?: string } };

/** Meta avisa cuando aprueba, rechaza o pausa una plantilla: se guarda y, si la rechaza, se avisa al equipo. */
async function estadosDePlantillas(cuerpo: string) {
  if (!hayServicio()) return;
  let datos: { entry?: { changes?: Cambio[] }[] };
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return;
  }
  const db = crearClienteServicio();
  for (const c of (datos.entry ?? []).flatMap((e) => e.changes ?? [])) {
    if (c.field !== "message_template_status_update" || !c.value?.message_template_name || !c.value.event) continue;
    const estado = estadoDeMeta(c.value.event);
    const { data: rechazada } = await db.rpc("plantilla_estado_meta", {
      p_nombre: c.value.message_template_name,
      p_idioma: c.value.message_template_language ?? null,
      p_estado: estado,
      p_motivo: c.value.reason ?? "",
      p_meta_id: c.value.message_template_id ? String(c.value.message_template_id) : null,
    } as never);
    if (rechazada)
      await avisarEquipo(db, "plantilla_rechazada", `${c.value.message_template_name}:${c.value.message_template_id ?? ""}`, {
        titulo: `Meta rechazó la plantilla ${c.value.message_template_name}`,
        texto: `Motivo: ${c.value.reason ?? "sin detalle"}. Corrígela y envíala de nuevo.`,
        ruta: "/consola/whatsapp",
      });
  }
}

type Mensajes = {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[];
        messages?: { from?: string; type?: string; text?: { body?: string }; button?: { text?: string } }[];
      };
    }[];
  }[];
};

const ESTADOS: Record<string, string> = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };
/** «BAJA», «STOP», «Cancelar»…: quien responde así deja de recibir WhatsApp de My House. */
const pideBaja = (t: string) => /^\s*(baja|stop|parar|cancelar|no m[aá]s|darme de baja)\s*[.!]*\s*$/i.test(t);

/** Estados de los mensajes enviados (entregado, leído, fallido) y bajas por respuesta. */
async function estadosDeMensajes(cuerpo: string) {
  if (!hayServicio()) return;
  let datos: Mensajes;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return;
  }
  const db = crearClienteServicio();
  for (const v of (datos.entry ?? []).flatMap((e) => e.changes ?? []).filter((c) => c.field === "messages").map((c) => c.value ?? {})) {
    for (const st of v.statuses ?? []) {
      const estado = ESTADOS[st.status ?? ""];
      if (st.id && estado) await db.rpc("mensaje_whatsapp_estado", { p_wamid: st.id, p_estado: estado, p_error: st.errors?.[0]?.message ?? st.errors?.[0]?.title ?? null } as never);
    }
    for (const m of v.messages ?? []) {
      const texto = m.text?.body ?? m.button?.text ?? "";
      if (m.from && pideBaja(texto)) await db.from("contactos").update({ whatsapp: false, updated_at: new Date().toISOString() }).eq("telefono", `+${m.from.replace(/\D/g, "")}`);
    }
  }
}
