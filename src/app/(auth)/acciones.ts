"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError, type Estado } from "@/lib/acciones";
import { destinoSeguro } from "@/lib/rutas";

const credenciales = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Escribe un correo válido.")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function ingresar(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(r.data);
  if (error) return { error: mensajeError(error) };
  redirect(destinoSeguro(datos.get("siguiente")?.toString()));
}

export async function registrarse(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales
    .extend({ nombre: z.string().trim().min(1, "Escribe tu nombre.").max(80) })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };

  const siguiente = destinoSeguro(datos.get("siguiente")?.toString(), "/onboarding");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: r.data.email,
    password: r.data.password,
    options: {
      data: { nombre: r.data.nombre },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}`,
    },
  });
  if (error) return { error: mensajeError(error) };
  if (!data.session) {
    return { ok: "Te enviamos un correo para confirmar tu cuenta. Ábrelo desde este dispositivo." };
  }
  redirect(siguiente);
}

/**
 * Envía el enlace para crear una contraseña nueva. Responde lo mismo exista o no la cuenta, para no revelar qué
 * correos están registrados.
 */
export async function pedirRecuperacion(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales.shape.email.safeParse(datos.get("email"));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(r.data, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirmar?siguiente=${encodeURIComponent("/nueva-contrasena")}`,
  });
  // Solo el límite de envíos se le muestra a la persona; lo demás (p. ej. correo inexistente) se calla.
  if (error && /security purposes|rate limit/i.test(error.message)) return { error: mensajeError(error) };
  return { ok: `Si ${r.data} tiene cuenta, te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.` };
}

/** La sesión viene del enlace de recuperación (abierto hace menos de una hora): no se pide la contraseña actual. */
function vieneDeRecuperacion(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  const hace = Date.now() / 1000 - 3600;
  return amr.some((m) => typeof m === "object" && m && ["recovery", "otp"].includes((m as { method?: string }).method ?? "") && ((m as { timestamp?: number }).timestamp ?? 0) > hace);
}

const nuevaContrasena = z
  .object({ password: credenciales.shape.password, confirmacion: z.string() })
  .refine((d) => d.password === d.confirmacion, { message: "Las dos contraseñas no coinciden.", path: ["confirmacion"] });

/**
 * Cambia la contraseña de quien tiene la sesión. Desde Configuración exige la actual (un celular desbloqueado no
 * basta para quedarse con la cuenta); desde el enlace de recuperación, no.
 */
export async function cambiarContrasena(_: Estado, datos: FormData): Promise<Estado> {
  const r = nuevaContrasena.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getClaims();
  const claims = sesion?.claims;
  if (!claims?.email) return { error: "Tu sesión terminó. Ingresa de nuevo." };
  const desdeEnlace = datos.get("modo") === "recuperacion";

  if (!desdeEnlace || !vieneDeRecuperacion(claims.amr)) {
    if (desdeEnlace) return { error: "El enlace ya venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };
    const actual = String(datos.get("actual") ?? "");
    if (!actual) return { error: "Escribe tu contraseña actual." };
    // Se verifica en un cliente aparte para no reemplazar la sesión abierta (perdería la verificación en dos pasos).
    const prueba = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await prueba.auth.signInWithPassword({ email: claims.email, password: actual });
    if (error) return { error: /Invalid login/.test(error.message) ? "La contraseña actual no es correcta." : mensajeError(error) };
    await prueba.auth.signOut({ scope: "local" });
  }

  const { error } = await supabase.auth.updateUser({ password: r.data.password });
  if (error) return { error: mensajeError(error) };
  return { ok: "Listo: tu contraseña cambió. Úsala la próxima vez que ingreses." };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
