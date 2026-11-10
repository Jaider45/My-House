import { createHash, timingSafeEqual } from "node:crypto";

/*
 * Wompi (pasarela para Colombia): Web Checkout para pagar cada periodo y eventos (webhook) para confirmarlo.
 * Funciones puras (sin red): firmas, URL del checkout y lectura de eventos. Probadas en wompi.test.ts.
 *
 * Variables (solo servidor): WOMPI_PUBLIC_KEY (pub_test_… o pub_prod_…), WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET.
 * Sin ellas la app no ofrece pagar (Configuración → Plan lo dice) y el webhook responde 503.
 */

export type ConfigWompi = { publica: string; integridad: string; eventos: string };

export function configWompi(env: NodeJS.ProcessEnv = process.env): ConfigWompi | null {
  const publica = env.WOMPI_PUBLIC_KEY ?? "";
  const integridad = env.WOMPI_INTEGRITY_SECRET ?? "";
  const eventos = env.WOMPI_EVENTS_SECRET ?? "";
  return publica && integridad && eventos ? { publica, integridad, eventos } : null;
}

export const esPruebas = (llavePublica: string) => llavePublica.startsWith("pub_test_");
export const apiWompi = (llavePublica: string) => (esPruebas(llavePublica) ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1");

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

/** Firma de integridad del checkout: SHA256(referencia + monto en centavos + moneda + secreto de integridad). */
export function firmaIntegridad(referencia: string, montoCentavos: number, secreto: string, moneda = "COP"): string {
  return sha256(`${referencia}${montoCentavos}${moneda}${secreto}`);
}

/** URL del Web Checkout. Wompi vuelve a `redireccion` con `?id=<transacción>`. */
export function urlCheckout(
  c: ConfigWompi,
  d: { referencia: string; monto: number; email?: string; nombre?: string; redireccion: string },
): string {
  const centavos = d.monto * 100;
  const p = new URLSearchParams({
    "public-key": c.publica,
    currency: "COP",
    "amount-in-cents": String(centavos),
    reference: d.referencia,
    "signature:integrity": firmaIntegridad(d.referencia, centavos, c.integridad),
    "redirect-url": d.redireccion,
  });
  if (d.email) p.set("customer-data:email", d.email);
  if (d.nombre) p.set("customer-data:full-name", d.nombre);
  return `https://checkout.wompi.co/p/?${p.toString()}`;
}

export type TransaccionWompi = {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING" | string;
  reference: string;
  amount_in_cents: number;
  payment_method_type?: string;
  payment_method?: { extra?: { brand?: string; last_four?: string; name?: string }; financial_institution_code?: string; phone_number?: string };
  status_message?: string | null;
};

export type EventoWompi = {
  event: string;
  data: { transaction?: TransaccionWompi } & Record<string, unknown>;
  environment?: string;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at?: string;
};

const valorEn = (obj: unknown, ruta: string): unknown =>
  ruta.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

/**
 * Verifica el checksum de un evento: SHA256(valores de `signature.properties` tomados de `data`, en orden, +
 * `timestamp` + secreto de eventos). Comparación en tiempo constante.
 */
export function eventoValido(e: EventoWompi, secretoEventos: string): boolean {
  if (!e?.signature?.properties?.length || !e.signature.checksum || e.timestamp === undefined) return false;
  const valores = e.signature.properties.map((p) => String(valorEn(e.data, p) ?? "")).join("");
  const esperado = Buffer.from(sha256(`${valores}${e.timestamp}${secretoEventos}`));
  const recibido = Buffer.from(String(e.signature.checksum).toLowerCase());
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

const METODOS: Record<string, string> = {
  CARD: "Tarjeta",
  PSE: "PSE",
  NEQUI: "Nequi",
  DAVIPLATA: "Daviplata",
  BANCOLOMBIA_TRANSFER: "Bancolombia",
  BANCOLOMBIA_QR: "Bancolombia QR",
  BANCOLOMBIA_COLLECT: "Bancolombia",
};

/** «Tarjeta» + «VISA ···4242», «Nequi» + «···3210», «PSE». */
export function describirMetodo(t: TransaccionWompi): { metodo: string; detalle: string | null } {
  const metodo = METODOS[t.payment_method_type ?? ""] ?? t.payment_method_type ?? "Otro";
  const x = t.payment_method?.extra;
  if (t.payment_method_type === "CARD" && x?.last_four) return { metodo, detalle: `${x.brand ?? ""} ···${x.last_four}`.trim() };
  if (t.payment_method_type === "NEQUI" && t.payment_method?.phone_number) return { metodo, detalle: `···${t.payment_method.phone_number.slice(-4)}` };
  return { metodo, detalle: null };
}
