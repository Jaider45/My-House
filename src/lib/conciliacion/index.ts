import { normalizarDescripcion } from "@/lib/importacion";

/**
 * Conciliación: decide si un pago que llega (comprobante del asistente, registro a mano, abono a una deuda) es el
 * mismo que ya está en la base, para no duplicarlo. Puro, sin base: las acciones traen los candidatos.
 *
 * - **Mismo movimiento**: igual tipo y monto a ±2 días (la regla de siempre del asistente).
 * - **Pago fijo pendiente** (programado): el pago lo confirma. Coincide por la regla o la deuda que dijo la familia
 *   (±20 días, cualquier monto), por la misma deuda (±10 días, monto ±25 %: los intereses cambian la cuota), por el
 *   nombre (±10 días, monto ±15 %) o por la categoría con el mismo monto (±10 días, ±2 %).
 * - **Abono sin deuda**: un gasto ya registrado con el mismo monto (±5 días) y sin deuda se liga a la deuda.
 */

export type Candidato = {
  id: string;
  fecha: string;
  monto: number;
  tipo: "gasto" | "ingreso" | "transferencia";
  estado: "confirmado" | "programado";
  category_id: string | null;
  debt_id: string | null;
  recurring_rule_id: string | null;
  comercio: string | null;
};

export type Pago = {
  tipo: "gasto" | "ingreso" | "transferencia";
  fecha: string;
  monto: number;
  category_id: string | null;
  comercio: string | null;
  /** Deuda que se está pagando (la eligió la familia o la leyó el asistente). */
  debt_id?: string | null;
  /** Pago fijo que la familia o el asistente dijo que es. */
  recurring_rule_id?: string | null;
};

export type Par = {
  candidato: Candidato;
  /** mismo = ya estaba registrado; pago_fijo = confirma un pendiente; ligar_deuda = el registrado pasa a ser abono. */
  motivo: "mismo" | "pago_fijo" | "ligar_deuda";
};

/** Días para buscar candidatos en la base (el máximo de las reglas). */
export const VENTANA_DIAS = 20;

const dia = (f: string) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10))) / 86_400_000;
export const diasEntre = (a: string, b: string) => Math.abs(dia(a) - dia(b));
const relativa = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b, 1);

/** Palabras que no distinguen un pago de otro. */
const VACIAS = new Set(["pago", "pagos", "cuota", "abono", "compra", "transferencia", "para", "del", "los", "las", "por", "con", "sas", "ltda"]);
const palabras = (t: string | null) => new Set(normalizarDescripcion(t ?? "").split(" ").filter((p) => p.length >= 4 && !VACIAS.has(p) && !/^\d+$/.test(p)));

/** Dos descripciones hablan de lo mismo si comparten al menos una palabra significativa («Cuota Bancolombia» ~ «BANCOLOMBIA PSE»). */
export function similares(a: string | null, b: string | null): boolean {
  const x = palabras(a);
  if (!x.size) return false;
  for (const p of palabras(b)) if (x.has(p)) return true;
  return false;
}

/** ¿El pago confirma este pendiente? Devuelve el puntaje (menor = mejor) o null. */
function puntajePendiente(p: Pago, c: Candidato): number | null {
  const d = diasEntre(p.fecha, c.fecha);
  const r = relativa(p.monto, c.monto);
  if (p.debt_id && c.debt_id && p.debt_id !== c.debt_id) return null;
  if (p.recurring_rule_id && c.recurring_rule_id === p.recurring_rule_id && d <= 20) return d / 10;
  if (p.debt_id && c.debt_id === p.debt_id && d <= 20 && r <= 0.5) return d / 10 + r;
  if (d > 10) return null;
  if (p.debt_id && c.debt_id === p.debt_id && r <= 0.25) return d + r * 30;
  if (similares(p.comercio, c.comercio) && r <= 0.15) return d + r * 30;
  if (p.category_id && c.category_id === p.category_id && r <= 0.02) return d + r * 30 + 1;
  if (p.monto === c.monto && d <= 2) return d + 2;
  return null;
}

/** ¿Es el mismo movimiento ya confirmado (o el abono que la deuda necesita)? */
function puntajeConfirmado(p: Pago, c: Candidato): { puntaje: number; motivo: Par["motivo"] } | null {
  const d = diasEntre(p.fecha, c.fecha);
  if (p.debt_id && c.debt_id && p.debt_id !== c.debt_id) return null;
  if (p.monto === c.monto && d <= 2) return { puntaje: d + (p.debt_id && !c.debt_id ? 0.5 : 0), motivo: p.debt_id && !c.debt_id ? "ligar_deuda" : "mismo" };
  if (p.debt_id && c.debt_id === p.debt_id && relativa(p.monto, c.monto) <= 0.02 && d <= 5) return { puntaje: d, motivo: "mismo" };
  if (p.debt_id && !c.debt_id && p.monto === c.monto && d <= 5 && (c.category_id === p.category_id || !c.category_id || similares(p.comercio, c.comercio))) {
    return { puntaje: d + 1, motivo: "ligar_deuda" };
  }
  return null;
}

/**
 * El movimiento existente que ya representa este pago, o null si hay que crearlo. Con `soloPendientes` (registro a
 * mano) no se miran los confirmados: dos cafés del mismo valor el mismo día son dos gastos.
 */
export function buscarPar(p: Pago, candidatos: Candidato[], o: { soloPendientes?: boolean } = {}): Par | null {
  let mejor: { par: Par; puntaje: number } | null = null;
  for (const c of candidatos) {
    if (c.tipo !== p.tipo) continue;
    let par: Par | null = null;
    let puntaje: number | null = null;
    if (c.estado === "programado") {
      puntaje = puntajePendiente(p, c);
      if (puntaje != null) par = { candidato: c, motivo: "pago_fijo" };
    } else if (!o.soloPendientes) {
      const x = puntajeConfirmado(p, c);
      if (x) {
        puntaje = x.puntaje;
        par = { candidato: c, motivo: x.motivo };
      }
    }
    if (par && puntaje != null && (!mejor || puntaje < mejor.puntaje)) mejor = { par, puntaje };
  }
  return mejor?.par ?? null;
}

/**
 * Al marcar un pago fijo como pagado: el movimiento ya registrado (comprobante, a mano, importado) que es ese mismo
 * pago, para unirlos en vez de tener dos. Solo confirmados que no vienen de otro pago fijo.
 */
export function buscarRegistrado(pendiente: Candidato, confirmados: Candidato[]): Candidato | null {
  let mejor: { c: Candidato; puntaje: number } | null = null;
  for (const c of confirmados) {
    if (c.id === pendiente.id || c.estado !== "confirmado" || c.recurring_rule_id || c.tipo !== pendiente.tipo) continue;
    const puntaje = puntajePendiente({ ...c, recurring_rule_id: null }, pendiente);
    if (puntaje != null && (!mejor || puntaje < mejor.puntaje)) mejor = { c, puntaje };
  }
  return mejor?.c ?? null;
}
