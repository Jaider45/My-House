"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { crearClienteConsola } from "@/lib/consola/sesion";
import { COOKIE_ACTIVIDAD } from "@/lib/consola/permisos";
import { entrar } from "@/lib/consola/ingreso";
import { destinoConsola } from "@/lib/consola/rutas";

const credenciales = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
  password: z.string().min(1, "Escribe tu contraseña."),
});

const captcha = (datos: FormData) => {
  const t = datos.get("captcha");
  return typeof t === "string" && t ? t : undefined;
};

/** No se dice si el correo existe ni si la cuenta es de un cliente: el mismo mensaje para todo. */
const NO_ENTRA = "Correo o contraseña incorrectos, o la cuenta no es del equipo de My House.";

/**
 * Paso 1: contraseña. Si la cuenta no es del equipo se cierra la sesión que se acaba de abrir. Luego la página de
 * ingreso pide el código (o, si la persona aún no tiene 2FA, /consola/dos-pasos la activa): la acción redirige y
 * la página decide con la sesión nueva.
 */
export async function ingresarConsola(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales.safeParse({ email: datos.get("email"), password: datos.get("password") });
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteConsola();
  const { data, error } = await supabase.auth.signInWithPassword({ ...r.data, options: { captchaToken: captcha(datos) } });
  if (error) {
    const m = mensajeError(error);
    return { error: m === "Correo o contraseña incorrectos." ? NO_ENTRA : m };
  }

  const { data: fila } = await supabase.from("platform_staff").select("activo").eq("user_id", data.user.id).maybeSingle();
  if (!fila?.activo) {
    await supabase.auth.signOut();
    return { error: NO_ENTRA };
  }

  const siguiente = destinoConsola(datos.get("siguiente"));
  const { data: factores } = await supabase.auth.mfa.listFactors();
  const conDosPasos = factores?.totp.some((f) => f.status === "verified");
  const consulta = `?siguiente=${encodeURIComponent(siguiente)}`;
  redirect(conDosPasos ? `/consola/ingresar${consulta}` : `/consola/dos-pasos${consulta}`);
}

/** Paso 2: código de la app autenticadora → sesión AAL2, registro en la auditoría y adentro. */
export async function verificarConsola(_: Estado, datos: FormData): Promise<Estado> {
  const code = String(datos.get("codigo") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Escribe los 6 dígitos del código." };
  const supabase = await crearClienteConsola();
  const { data: factores, error: e } = await supabase.auth.mfa.listFactors();
  if (e) return { error: mensajeError(e) };
  const factor = factores.totp.find((f) => f.status === "verified");
  if (!factor) return { error: "No tienes un autenticador configurado." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: mensajeError(error) };
  return entrar(supabase, datos.get("siguiente"));
}

export async function salirConsola() {
  const supabase = await crearClienteConsola();
  await supabase.auth.signOut();
  (await cookies()).delete({ name: COOKIE_ACTIVIDAD, path: "/consola" });
  redirect("/consola/ingresar");
}
