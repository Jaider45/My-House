import { createHash, timingSafeEqual } from "node:crypto";

/*
 * Wompi (pasarela para Colombia). El pago se hace dentro de la app: la tarjeta se tokeniza en el navegador
 * (`cliente.ts`) y el servidor crea la transacción por la API (`servidor.ts`); los eventos (webhook) y la consulta de
 * la transacción la confirman. Aquí, funciones puras (sin red): firmas, referencias y lectura de eventos.
 *
 * Llaves: pública (pub_test_… o pub_prod_…), secretos de integridad y de eventos, y la privada (prv_…) para guardar
 * tarjetas y renovar solo. Se conectan en consola → Integraciones (o WOMPI_* en el entorno).
 */

export { apiWompi, esPruebas } from "./cliente";

/** `privada` es opcional: sin ella se puede pagar, pero no guardar la tarjeta ni renovar solo. */
export type ConfigWompi = { publica: string; integridad: string; eventos: string; privada?: string };

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

/** Firma de integridad del checkout: SHA256(referencia + monto en centavos + moneda + secreto de integridad). */
export function firmaIntegridad(referencia: string, montoCentavos: number, secreto: string, moneda = "COP"): string {
  return sha256(`${referencia}${montoCentavos}${moneda}${secreto}`);
}

/** Wompi exige una referencia por transacción: el primer intento usa la del cobro y los demás `<ref>.<n>`. */
export function referenciaIntento(referencia: string, intentos: number): string {
  return intentos > 0 ? `${referencia}.${intentos + 1}` : referencia;
}

export type TransaccionWompi = {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING" | string;
  reference: string;
  amount_in_cents: number;
  payment_method_type?: string;
  payment_method?: { extra?: { brand?: string; last_four?: string; name?: string }; financial_institution_code?: string; phone_number?: string };
  payment_source_id?: number | null;
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
