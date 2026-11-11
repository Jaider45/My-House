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

/** Lo que va en los metadatos de `signUp`: el trigger `consentimiento_al_registrarse` lo guarda. */
export async function consentimientoDeRegistro(comunicaciones: boolean) {
  return { version: VERSION_LEGAL, comunicaciones, ...(await origenSolicitud()) };
}

/** ¿La persona aceptó la política en la versión vigente? */
export async function aceptoVersionVigente(supabase: Cliente, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("consentimientos")
    .select("id")
    .eq("user_id", userId)
    .eq("tipo", "politica_datos")
    .eq("version", VERSION_LEGAL)
    .eq("aceptado", true)
    .limit(1);
  return !!data?.length;
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

/**
 * Para las acciones que dejan entrar a la app (crear hogar, aceptar invitación): si la persona no ha aceptado la
 * versión vigente (cuenta creada con Google, o versión nueva), exige las casillas del formulario y las registra.
 * Devuelve un mensaje de error o null.
 */
export async function exigirConsentimiento(supabase: Cliente, userId: string, datos: FormData): Promise<string | null> {
  if (await aceptoVersionVigente(supabase, userId)) return null;
  if (datos.get("acepto") !== "1") return FALTA_ACEPTAR;
  const { ip, agente } = await origenSolicitud();
  const cliente = await crearClienteServidor({ ...(ip && { "x-mh-ip": ip }), ...(agente && { "x-mh-agente": agente }) });
  const { error } = await cliente.rpc("aceptar_consentimientos", {
    p_version: VERSION_LEGAL,
    p_comunicaciones: datos.get("comunicaciones") === "1",
  });
  return error ? "No pudimos guardar tu aceptación. Intenta de nuevo." : null;
}
