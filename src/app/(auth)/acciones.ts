"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeError, type Estado } from "@/lib/acciones";
import { verificoCorreoHacePoco } from "@/lib/contrasena";
import { destinoSeguro } from "@/lib/rutas";
import { avisarSiDispositivoNuevo } from "@/lib/correo/acceso";

const correo = z
  .string("Escribe tu correo.")
  .trim()
  .toLowerCase()
  .pipe(z.email("Escribe un correo válido."));

const credenciales = z.object({
  email: correo,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

/** Regreso desde los correos y desde Google: /auth/confirmar abre la sesión y sigue a `siguiente`. */
const confirmar = (siguiente: string) =>
  `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}`;

/** Token del widget de Turnstile (vacío si el captcha no está activo en este despliegue). */
const captcha = (datos: FormData) => {
  const t = datos.get("captcha");
  return typeof t === "string" && t ? t : undefined;
};

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Adónde ir tras abrir sesión. La redirección de una acción se renderiza en la misma petición, sin volver a pasar
 * por el proxy: si la persona tiene verificación en dos pasos hay que mandarla a /mfa aquí, o vería la primera
 * pantalla sin el código.
 */
async function destinoTrasIngreso(supabase: Cliente, siguiente: string) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
    return siguiente === "/" ? "/mfa" : `/mfa?siguiente=${encodeURIComponent(siguiente)}`;
  }
  return siguiente;
}

export async function ingresar(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales.safeParse({ email: datos.get("email"), password: datos.get("password") });
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ ...r.data, options: { captchaToken: captcha(datos) } });
  if (error) return { error: mensajeError(error) };
  await avisarSiDispositivoNuevo(supabase);
  redirect(await destinoTrasIngreso(supabase, destinoSeguro(datos.get("siguiente")?.toString())));
}

export async function registrarse(_: Estado, datos: FormData): Promise<Estado> {
  const r = credenciales
    .extend({ nombre: z.string().trim().min(1, "Escribe tu nombre.").max(80) })
    .safeParse({ email: datos.get("email"), password: datos.get("password"), nombre: datos.get("nombre") });
  if (!r.success) return { error: r.error.issues[0].message };

  const siguiente = destinoSeguro(datos.get("siguiente")?.toString(), "/onboarding");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: r.data.email,
    password: r.data.password,
    options: {
      data: { nombre: r.data.nombre },
      emailRedirectTo: confirmar(siguiente),
      captchaToken: captcha(datos),
    },
  });
  if (error) return { error: mensajeError(error) };
  if (!data.session) {
    return { ok: "Te enviamos un correo para confirmar tu cuenta. Ábrelo desde este dispositivo." };
  }
  await avisarSiDispositivoNuevo(supabase); // cuenta nueva: solo marca este navegador como conocido
  redirect(siguiente);
}

/** Solo el límite de envíos y el captcha se le muestran a la persona; lo demás (p. ej. correo inexistente) se calla. */
const errorVisible = (e: { message: string } | null) => e && /security purposes|rate limit|captcha/i.test(e.message);

/**
 * Envía el enlace para crear una contraseña nueva. Responde lo mismo exista o no la cuenta, para no revelar qué
 * correos están registrados.
 */
export async function pedirRecuperacion(_: Estado, datos: FormData): Promise<Estado> {
  const r = correo.safeParse(datos.get("email"));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(r.data, {
    redirectTo: confirmar("/nueva-contrasena"),
    captchaToken: captcha(datos),
  });
  if (errorVisible(error)) return { error: mensajeError(error!) };
  return { ok: `Si ${r.data} tiene cuenta, te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.` };
}

export type EstadoCodigo = (Estado & { email?: string; enviado?: boolean }) | null;

/** Primer paso del ingreso con código: lo envía al correo. Solo a cuentas existentes (no crea usuarios). */
export async function pedirCodigo(_: EstadoCodigo, datos: FormData): Promise<EstadoCodigo> {
  const r = correo.safeParse(datos.get("email"));
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email: r.data,
    options: { shouldCreateUser: false, captchaToken: captcha(datos) },
  });
  if (errorVisible(error)) return { error: mensajeError(error!), email: r.data };
  return { ok: `Si ${r.data} tiene cuenta, te llegó un código de 6 dígitos. Revisa también la carpeta de spam.`, email: r.data, enviado: true };
}

/** Segundo paso: valida el código y abre la sesión. */
export async function verificarCodigo(previo: EstadoCodigo, datos: FormData): Promise<EstadoCodigo> {
  const email = correo.safeParse(datos.get("email"));
  const codigo = String(datos.get("codigo") ?? "").replace(/\D/g, "");
  if (!email.success) return { error: "Vuelve a escribir tu correo." };
  if (codigo.length !== 6) return { ...previo, ok: undefined, error: "El código tiene 6 dígitos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token: codigo, type: "email" });
  if (error) return { email: email.data, enviado: true, error: mensajeError(error) };
  await avisarSiDispositivoNuevo(supabase);
  redirect(await destinoTrasIngreso(supabase, destinoSeguro(datos.get("siguiente")?.toString())));
}

/** Ingreso (o registro) con Google. El regreso pasa por /auth/confirmar, que abre la sesión. */
export async function ingresarConGoogle(datos: FormData) {
  const siguiente = destinoSeguro(datos.get("siguiente")?.toString());
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: confirmar(siguiente), queryParams: { prompt: "select_account" } },
  });
  redirect(error || !data.url ? "/ingresar?error=google" : data.url);
}

const nuevaContrasena = z
  .object({ password: credenciales.shape.password, confirmacion: z.string() })
  .refine((d) => d.password === d.confirmacion, { message: "Las dos contraseñas no coinciden.", path: ["confirmacion"] });

/**
 * Cambia la contraseña de quien tiene la sesión. Pide la actual, salvo que la sesión se haya abierto hace menos de
 * una hora con el enlace de recuperación o con un código al correo. Por defecto cierra las demás sesiones.
 */
export async function cambiarContrasena(_: Estado, datos: FormData): Promise<Estado> {
  const r = nuevaContrasena.safeParse({ password: datos.get("password"), confirmacion: datos.get("confirmacion") });
  if (!r.success) return { error: r.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getClaims();
  const claims = sesion?.claims;
  if (!claims?.sub) return { error: "Tu sesión terminó. Ingresa de nuevo." };

  if (!verificoCorreoHacePoco(claims.amr)) {
    if (datos.get("modo") === "recuperacion") return { error: "El enlace ya venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };
    const actual = String(datos.get("actual") ?? "");
    if (!actual) return { error: "Escribe tu contraseña actual." };
    // Se compara en la base (sin abrir otra sesión ni pasar por el captcha); tras un fallo espera 1 s.
    const { data: correcta, error } = await supabase.rpc("verificar_contrasena_actual", { clave: actual });
    if (error) return { error: mensajeError(error) };
    if (!correcta) return { error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password: r.data.password });
  if (error) return { error: mensajeError(error) };
  const otras = datos.get("cerrar_otras") === "on";
  if (otras) await supabase.auth.signOut({ scope: "others" });
  return {
    ok: otras
      ? "Listo: tu contraseña cambió y cerramos tu sesión en los demás dispositivos."
      : "Listo: tu contraseña cambió. Úsala la próxima vez que ingreses.",
  };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  // Vacía la caché de navegación del navegador: si alguien más entra en este equipo, no ve ni un resto del layout
  // anterior (nombre del hogar, selector) mientras llega la pantalla nueva.
  revalidatePath("/", "layout");
  redirect("/ingresar");
}
