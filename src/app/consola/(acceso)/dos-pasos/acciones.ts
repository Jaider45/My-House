"use server";

import { mensajeError, type Estado } from "@/lib/acciones";
import { crearClienteConsola } from "@/lib/consola/sesion";
import { entrar } from "@/lib/consola/ingreso";

/** Confirma el primer código del autenticador recién inscrito (la sesión sube a AAL2) y entra a la consola. */
export async function activarDosPasosConsola(_: Estado, datos: FormData): Promise<Estado> {
  const factorId = String(datos.get("factor") ?? "");
  const code = String(datos.get("codigo") ?? "").replace(/\D/g, "");
  if (!factorId) return { error: "Genera el código QR primero." };
  if (code.length !== 6) return { error: "Escribe los 6 dígitos del código." };
  const supabase = await crearClienteConsola();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: mensajeError(error) };
  return entrar(supabase, datos.get("siguiente"));
}
