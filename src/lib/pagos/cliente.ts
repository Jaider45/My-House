/*
 * Piezas del pago que corren en el navegador (módulo liviano: sin node:crypto ni supabase).
 * La tarjeta se tokeniza directamente contra Wompi con la llave pública: el número, la fecha y el CVC nunca llegan
 * a nuestro servidor (los campos del formulario no tienen `name` y no se envían). El servidor solo recibe el token.
 */

export const esPruebas = (llavePublica: string) => llavePublica.startsWith("pub_test_");
export const apiWompi = (llavePublica: string) => (esPruebas(llavePublica) ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1");

export const soloDigitos = (v: string) => v.replace(/\D/g, "");

/** Algoritmo de Luhn: descarta errores de digitación antes de llamar a Wompi. */
export function luhnValido(numero: string): boolean {
  const d = soloDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
  }
  return suma % 10 === 0;
}

export type Marca = "VISA" | "MASTERCARD" | "AMEX" | "DINERS" | null;

export function marcaDe(numero: string): Marca {
  const d = soloDigitos(numero);
  if (/^4/.test(d)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "MASTERCARD";
  if (/^3[47]/.test(d)) return "AMEX";
  if (/^3(0[0-5]|[68])/.test(d)) return "DINERS";
  return null;
}

/** «4242 4242 4242 4242» (Amex: 4-6-5). */
export function formatearTarjeta(v: string): string {
  const d = soloDigitos(v).slice(0, 19);
  if (marcaDe(d) === "AMEX") return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  return d.replace(/(.{4})/g, "$1 ").trim();
}

/** «MM/AA» mientras se escribe. */
export function formatearVence(v: string): string {
  const d = soloDigitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** Valida «MM/AA» contra el mes actual. Devuelve el mes y el año en dos dígitos, o null. */
export function venceValido(v: string, hoy = new Date()): { mes: string; anio: string } | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  const actual = hoy.getFullYear() * 12 + hoy.getMonth();
  if (anio * 12 + (mes - 1) < actual || anio > hoy.getFullYear() + 20) return null;
  return { mes: m[1], anio: m[2] };
}

export type DatosTarjeta = { numero: string; vence: string; cvc: string; titular: string };

/** Primer error de una tarjeta, o null si se puede tokenizar. */
export function errorTarjeta(t: DatosTarjeta): string | null {
  if (!luhnValido(t.numero)) return "Revisa el número de la tarjeta.";
  if (!venceValido(t.vence)) return "Revisa la fecha de vencimiento (MM/AA).";
  const cvc = soloDigitos(t.cvc);
  if (cvc.length < 3 || cvc.length > 4) return "El código de seguridad tiene 3 o 4 dígitos.";
  if (t.titular.trim().length < 5) return "Escribe el nombre como aparece en la tarjeta.";
  return null;
}

export type TarjetaTokenizada = { token: string; marca: string; ultimos4: string; vence: string; titular: string };

/** Tokeniza la tarjeta en Wompi (POST /tokens/cards con la llave pública). Lanza Error con un mensaje para mostrar. */
export async function tokenizarTarjeta(llavePublica: string, t: DatosTarjeta, base = apiWompi(llavePublica)): Promise<TarjetaTokenizada> {
  const error = errorTarjeta(t);
  if (error) throw new Error(error);
  const v = venceValido(t.vence)!;
  let r: Response;
  try {
    r = await fetch(`${base}/tokens/cards`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${llavePublica}` },
      body: JSON.stringify({ number: soloDigitos(t.numero), cvc: soloDigitos(t.cvc), exp_month: v.mes, exp_year: v.anio, card_holder: t.titular.trim() }),
    });
  } catch {
    throw new Error("No pudimos conectar con la pasarela de pagos. Revisa tu conexión e intenta de nuevo.");
  }
  const d = (await r.json().catch(() => ({}))) as { data?: { id?: string; brand?: string; last_four?: string; card_holder?: string }; error?: { messages?: Record<string, string[]> } };
  if (!r.ok || !d.data?.id) {
    const detalle = d.error?.messages ? Object.values(d.error.messages).flat()[0] : null;
    throw new Error(detalle ? `La tarjeta no se pudo validar: ${detalle}` : "La tarjeta no se pudo validar. Revisa los datos.");
  }
  return { token: d.data.id, marca: d.data.brand ?? marcaDe(t.numero) ?? "", ultimos4: d.data.last_four ?? soloDigitos(t.numero).slice(-4), vence: t.vence, titular: t.titular.trim() };
}

/** Celular colombiano para Nequi: 10 dígitos que empiezan por 3. */
export const celularValido = (v: string) => /^3\d{9}$/.test(soloDigitos(v));
