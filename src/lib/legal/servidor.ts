import "server-only";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";
import { VERSION_LEGAL } from "./responsable";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export const FALTA_ACEPTAR = "Para continuar, acepta los términos y la política de tratamiento de datos.";

/** IP y navegador de quien hace la petición: prueba de la autorización (Ley 1581). */
export async function origenSolicitud(): Promise<{ ip: string; agente: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "").slice(0, 64);
  const agente = (h.get("user-agent") ?? "").replace(/[^\x20-\x7e]/g, "").slice(0, 300);
  return { ip, agente };
}

/**
 * Lo que va en los metadatos de `signUp`: el trigger `consentimiento_al_registrarse` lo guarda con la versión
 * vigente de cada documento en la base (`version` solo sirve si la base aún no tiene documentos).
 */
export async function consentimientoDeRegistro(comunicaciones: boolean) {
  return { version: VERSION_LEGAL, comunicaciones, ...(await origenSolicitud()) };
}

/**
 * ¿La persona ya aceptó los documentos obligatorios en la versión que se exige? (Consola → Legal: una versión
 * publicada con «Pedir aceptación de nuevo» vuelve a pedirlos.)
 */
export async function aceptoVersionVigente(supabase: Cliente): Promise<boolean> {
  const { data, error } = await supabase.rpc("mis_pendientes_legales");
  if (error) return false;
  return ((data ?? []) as unknown[]).length === 0;
}

/** Última respuesta de la persona sobre comunicaciones comerciales (false si nunca respondió). */
export async function aceptaComunicaciones(supabase: Cliente, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("consentimientos")
    .select("aceptado")
    .eq("user_id", userId)
    .eq("tipo", "comunicaciones")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.aceptado ?? false;
}

/** Acepta los documentos vigentes desde la ventana que aparece al publicarse una versión nueva. */
export async function aceptarVigentes(): Promise<string | null> {
  const { ip, agente } = await origenSolicitud();
  const cliente = await crearClienteServidor({ ...(ip && { "x-mh-ip": ip }), ...(agente && { "x-mh-agente": agente }) });
  const { error } = await cliente.rpc("aceptar_vigentes", {});
  return error ? "No pudimos guardar tu aceptación. Intenta de nuevo." : null;
}

/**
 * Para las acciones que dejan entrar a la app (crear hogar, aceptar invitación): si la persona no ha aceptado la
 * versión vigente (cuenta creada con Google, o versión nueva), exige las casillas del formulario y las registra.
 * Devuelve un mensaje de error o null.
 */
export async function exigirConsentimiento(supabase: Cliente, datos: FormData): Promise<string | null> {
  if (await aceptoVersionVigente(supabase)) return null;
  if (datos.get("acepto") !== "1") return FALTA_ACEPTAR;
  const { ip, agente } = await origenSolicitud();
  const cliente = await crearClienteServidor({ ...(ip && { "x-mh-ip": ip }), ...(agente && { "x-mh-agente": agente }) });
  const { error } = await cliente.rpc("aceptar_vigentes", { p_comunicaciones: datos.get("comunicaciones") === "1" });
  return error ? "No pudimos guardar tu aceptación. Intenta de nuevo." : null;
}
