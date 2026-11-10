"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { integracion, type Proveedor } from "@/lib/integraciones/catalogo";
import { enviarPlantillaWhatsapp, leerIntegracion, olvidar, probar } from "@/lib/integraciones/servidor";
import { enviarCorreo } from "@/lib/correo/enviar";

/*
 * Integraciones (consola → Sistema). Solo con el permiso `sistema` (superadmin). La base lo vuelve a exigir, cifra los
 * secretos en Vault y deja cada cambio en la auditoría (sin valores). Los secretos nunca vuelven al navegador.
 */

export type EstadoIntegracion = (NonNullable<Estado> & { plantillas?: { name: string; status: string; category: string; language: string }[] }) | null;

const SIN_PERMISO = "Solo un superadmin conecta integraciones.";

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("sistema") ? staff : null;
}

function proveedorDe(datos: FormData): Proveedor | null {
  const p = String(datos.get("proveedor") ?? "");
  return integracion(p) ? (p as Proveedor) : null;
}

function validar(p: Proveedor, config: Record<string, string>): string | null {
  if (p === "wompi" && config.llave_publica && !/^pub_(test|prod)_\w+$/.test(config.llave_publica)) return "La llave pública de Wompi empieza por pub_test_ o pub_prod_.";
  if (p === "resend" && config.remitente && !/^[^<>]*<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>$|^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.remitente))
    return "El remitente va como «My House <no-responder@tu-dominio.com>».";
  if (p === "whatsapp" && ((config.phone_number_id && !/^\d{5,30}$/.test(config.phone_number_id)) || (config.waba_id && !/^\d{5,30}$/.test(config.waba_id))))
    return "Los identificadores de WhatsApp son solo números.";
  return null;
}

/** Prueba con la configuración guardada y deja el resultado en la integración. */
async function probarYRegistrar(staff: Awaited<ReturnType<typeof obtenerStaff>>, p: Proveedor) {
  olvidar(p);
  const actual = await leerIntegracion(p);
  if (!actual) return { ok: false, detalle: "Faltan datos obligatorios." };
  const r = await probar(p, actual.valores);
  if (actual.origen === "consola") await staff.supabase.rpc("consola_registrar_verificacion", { p_proveedor: p, p_ok: r.ok, p_detalle: r.detalle });
  return r;
}

export async function guardarIntegracion(_: EstadoIntegracion, datos: FormData): Promise<EstadoIntegracion> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const p = proveedorDe(datos);
  if (!p) return { error: "Integración no válida." };
  const def = integracion(p)!;

  const config: Record<string, string> = {};
  const secretos: Record<string, string> = {};
  for (const c of def.campos) {
    const v = String(datos.get(c.clave) ?? "").trim();
    if (c.secreto) {
      if (v) secretos[c.clave] = v;
    } else config[c.clave] = v;
  }
  // El token de verificación del webhook de WhatsApp lo generamos si no lo escriben.
  if (p === "whatsapp" && !config.verify_token) config.verify_token = randomBytes(18).toString("base64url");
  const error = validar(p, config);
  if (error) return { error };

  const { error: e } = await staff.supabase.rpc("consola_guardar_integracion", { p_proveedor: p, p_config: config, p_secretos: secretos, p_activa: true });
  if (e) return { error: mensajeError(e) };
  const r = await probarYRegistrar(staff, p);
  revalidatePath("/consola/integraciones");
  return r.ok ? { ok: `Conectada. ${r.detalle}`, plantillas: (r.extra as { plantillas?: [] })?.plantillas } : { error: `Guardada, pero la prueba falló: ${r.detalle}` };
}

export async function probarIntegracion(_: EstadoIntegracion, datos: FormData): Promise<EstadoIntegracion> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const p = proveedorDe(datos);
  if (!p) return { error: "Integración no válida." };
  const r = await probarYRegistrar(staff, p);
  revalidatePath("/consola/integraciones");
  return r.ok ? { ok: r.detalle, plantillas: (r.extra as { plantillas?: [] })?.plantillas } : { error: r.detalle };
}

export async function desconectarIntegracion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const p = proveedorDe(datos);
  if (!p) return { error: "Integración no válida." };
  const { error } = await staff.supabase.rpc("consola_desconectar_integracion", { p_proveedor: p });
  if (error) return { error: mensajeError(error) };
  olvidar(p);
  revalidatePath("/consola/integraciones");
  return { ok: "Desconectada." };
}

export async function enviarCorreoPrueba(): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  olvidar("resend");
  const r = await enviarCorreo({
    para: staff.email,
    etiqueta: "prueba",
    contenido: {
      asunto: "Correo de prueba de My House",
      vistaPrevia: "Si lees esto, el correo está bien conectado.",
      etiqueta: "Prueba",
      titulo: "El correo está conectado",
      intro: `Hola ${staff.nombre.split(" ")[0]}, este correo lo envió la consola para comprobar la integración con Resend.`,
      porque: "Recibes este correo porque lo pediste desde la consola de My House.",
    },
  });
  if (!r.enviado) return { error: r.error ? `No salió: ${r.error}` : "Resend no está conectado." };
  await staff.supabase.rpc("consola_registrar_verificacion", { p_proveedor: "resend", p_ok: true, p_detalle: `Correo de prueba enviado a ${staff.email} por ${r.via}` });
  revalidatePath("/consola/integraciones");
  return { ok: `Enviado a ${staff.email}${r.via === "mailpit" ? " (Mailpit local)" : ""}. Revisa tu bandeja.` };
}

export async function enviarWhatsappPrueba(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const numero = String(datos.get("numero") ?? "");
  const plantilla = String(datos.get("plantilla") ?? "hello_world").trim() || "hello_world";
  if (!/^[a-z0-9_]{1,512}$/.test(plantilla)) return { error: "Nombre de plantilla no válido." };
  const idioma = plantilla === "hello_world" ? "en_US" : "es";
  const r = await enviarPlantillaWhatsapp(numero, plantilla, idioma);
  return r.ok ? { ok: `Mensaje «${plantilla}» enviado. Revisa WhatsApp.` } : { error: r.detalle };
}
