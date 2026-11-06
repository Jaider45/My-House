/** Resultado estándar de una Server Action consumida con useActionState. */
export type Estado = { error?: string; ok?: string } | null;

/** Traduce errores de Postgres/Supabase a mensajes para la persona. */
export function mensajeError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Ocurrió un error inesperado.";
  const m = error.message ?? "";
  if (error.code === "23505") return "Ya existe un registro con esos datos.";
  if (error.code === "23503") return "Ese registro está en uso o hace referencia a algo que no existe.";
  if (error.code === "42501" || m.includes("row-level security")) return "No tienes permiso para hacer esto.";
  if (m.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("User already registered")) return "Ese correo ya tiene una cuenta. Ingresa en su lugar.";
  if (m.includes("Password should be")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("should be different from the old")) return "La contraseña nueva debe ser distinta de la actual.";
  if (m.includes("Email not confirmed")) return "Aún no confirmas tu correo. Abre el enlace que te enviamos.";
  if (/captcha/i.test(m)) return "No pudimos comprobar que no eres un robot. Espera a que cargue la verificación y vuelve a intentarlo.";
  if (m.includes("Token has expired or is invalid")) return "El código no es válido o ya venció. Pide uno nuevo.";
  if (m.includes("Signups not allowed")) return "No hay una cuenta con ese correo. Crea una primero.";
  if (m.includes("security purposes") || /rate limit/i.test(m)) return "Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo.";
  if (m.includes("Invalid TOTP") || m.includes("invalid") && m.includes("code")) return "El código no es válido. Intenta de nuevo.";
  // Las excepciones de nuestras funciones SQL ya vienen en español.
  return m || "Ocurrió un error inesperado.";
}
