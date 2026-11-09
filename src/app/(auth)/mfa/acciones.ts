"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError } from "@/lib/acciones";

/**
 * Verifica el código de la app autenticadora y sube la sesión a AAL2 (las cookies nuevas las escribe el cliente
 * de servidor). Va en el servidor, no con supabase-js en el navegador: así /mfa no descarga ~260 KB de JS.
 * Ver docs/MEJORAS.md («Rendimiento React»). No redirige: navega el cliente (decisión 29 de CLAUDE.md).
 */
export async function verificarMfa(codigo: string): Promise<{ error?: string }> {
  const code = codigo.replace(/\D/g, "");
  if (code.length !== 6) return { error: "Escribe los 6 dígitos del código." };
  const supabase = await crearClienteServidor();
  const { data: factores, error: e } = await supabase.auth.mfa.listFactors();
  if (e) return { error: mensajeError(e) };
  const factor = factores.totp.find((f) => f.status === "verified");
  if (!factor) return { error: "No hay un autenticador configurado." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  return error ? { error: mensajeError(error) } : {};
}
