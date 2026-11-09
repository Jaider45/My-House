"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError } from "@/lib/acciones";

/*
 * Verificación en dos pasos (TOTP). Antes se hacía con supabase-js en el navegador, lo que sumaba ~260 KB de JS
 * (68 KB comprimidos) a esta pantalla y a /mfa. Ver docs/MEJORAS.md («Rendimiento React»).
 * Cada persona solo maneja sus propios factores: Supabase Auth los toma de la sesión de las cookies.
 */

export type Inscripcion = { factorId: string; qr: string; secreto: string };

/** Borra inscripciones a medias y crea una nueva: devuelve el QR y la clave manual. */
export async function iniciarDosPasos(): Promise<{ error: string } | { inscripcion: Inscripcion }> {
  const supabase = await crearClienteServidor();
  const { data: factores } = await supabase.auth.mfa.listFactors();
  await Promise.all(
    (factores?.all ?? []).filter((f) => f.status === "unverified").map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
  );
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "My House" });
  if (error) return { error: mensajeError(error) };
  return { inscripcion: { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret } };
}

export async function confirmarDosPasos(factorId: string, codigo: string): Promise<{ error?: string }> {
  const code = codigo.replace(/\D/g, "");
  if (code.length !== 6) return { error: "Escribe los 6 dígitos del código." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return error ? { error: mensajeError(error) } : {};
}

export async function desactivarDosPasos(factorId: string): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return error ? { error: mensajeError(error) } : {};
}
