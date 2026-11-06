/** Mínimo exigido en el formulario y en el servidor (Supabase acepta 6; pedimos 8). */
export const MINIMO_CONTRASENA = 8;

export type FuerzaContrasena = {
  /** 0 = vacía o corta, 1 = débil, 2 = aceptable, 3 = fuerte. */
  nivel: 0 | 1 | 2 | 3;
  etiqueta: string;
  /** Qué falta para subir de nivel (vacío si ya es fuerte). */
  consejo: string;
};

// Las que más aparecen en filtraciones, más las obvias para esta app.
const COMUNES = ["12345678", "123456789", "1234567890", "password", "contraseña", "contrasena", "qwertyui", "myhouse", "colombia"];

/**
 * Estimación orientativa para el medidor del registro: largo y variedad de caracteres, castigando repeticiones y
 * contraseñas comunes. No bloquea nada más allá del mínimo.
 */
export function evaluarContrasena(valor: string): FuerzaContrasena {
  if (valor.length < MINIMO_CONTRASENA) {
    const faltan = MINIMO_CONTRASENA - valor.length;
    return { nivel: 0, etiqueta: "Muy corta", consejo: valor ? faltan === 1 ? "Falta 1 carácter." : `Faltan ${faltan} caracteres.` : `Mínimo ${MINIMO_CONTRASENA} caracteres.` };
  }
  const minuscula = valor.toLowerCase();
  const variedad = [/[a-záéíóúñ]/, /[A-ZÁÉÍÓÚÑ]/, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(valor)).length;
  const repetitiva = new Set(minuscula).size <= 3;
  if (repetitiva || COMUNES.some((c) => minuscula.includes(c))) {
    return { nivel: 1, etiqueta: "Débil", consejo: "Es fácil de adivinar. Evita secuencias y palabras comunes." };
  }
  const puntos = (valor.length >= 12 ? 2 : valor.length >= 10 ? 1 : 0) + Math.max(0, variedad - 1);
  if (puntos >= 3) return { nivel: 3, etiqueta: "Fuerte", consejo: "" };
  if (puntos >= 1) return { nivel: 2, etiqueta: "Aceptable", consejo: "Más larga o con números y símbolos sería mejor." };
  return { nivel: 1, etiqueta: "Débil", consejo: "Combina mayúsculas, números o símbolos, o usa una frase." };
}
