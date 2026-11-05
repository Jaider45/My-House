import { z } from "zod";
import { parsearFecha } from "@/lib/fechas";

/** Orígenes posibles de un movimiento. ocr/whatsapp/banco quedan listos para fases futuras. */
export const ORIGENES = ["manual", "importacion", "recurrente", "ocr", "whatsapp", "banco"] as const;

const uuidOpcional = z
  .union([z.uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const textoOpcional = (max: number) =>
  z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null)
    .pipe(z.string().max(max, `Máximo ${max} caracteres.`).nullable());

/**
 * Esquema único de un movimiento, venga de donde venga. Montos en pesos enteros positivos;
 * el signo lo da el tipo. Las transferencias van entre dos cuentas y no llevan categoría.
 */
export const esquemaMovimiento = z
  .object({
    tipo: z.enum(["ingreso", "gasto", "transferencia"]),
    fecha: z.string().transform((v, c) => {
      const iso = parsearFecha(v);
      if (!iso) c.addIssue({ code: "custom", message: "La fecha no es válida." });
      return iso ?? "";
    }),
    monto: z.coerce.number().int("El monto debe ser en pesos enteros.").positive("Escribe un monto mayor que cero.").max(1e13),
    account_id: z.uuid("Elige una cuenta."),
    cuenta_destino_id: uuidOpcional,
    category_id: uuidOpcional,
    member_id: uuidOpcional,
    tax_tag_id: uuidOpcional,
    comercio: textoOpcional(200),
    nota: textoOpcional(1000),
    estado: z.enum(["confirmado", "programado"]).default("confirmado"),
    ambito: z.enum(["personal", "negocio"]).default("personal"),
    origen: z.enum(ORIGENES).default("manual"),
  })
  .superRefine((m, c) => {
    if (m.tipo === "transferencia") {
      if (!m.cuenta_destino_id) c.addIssue({ code: "custom", path: ["cuenta_destino_id"], message: "Elige la cuenta destino." });
      if (m.cuenta_destino_id === m.account_id) c.addIssue({ code: "custom", path: ["cuenta_destino_id"], message: "La cuenta destino debe ser otra." });
    } else if (!m.category_id && m.origen === "manual") {
      // Lo importado puede entrar sin categoría y categorizarse después.
      c.addIssue({ code: "custom", path: ["category_id"], message: "Elige una categoría." });
    }
  })
  .transform((m) =>
    m.tipo === "transferencia" ? { ...m, category_id: null } : { ...m, cuenta_destino_id: null },
  );

export type EntradaMovimiento = z.input<typeof esquemaMovimiento>;
export type Movimiento = z.output<typeof esquemaMovimiento>;

export function validarMovimiento(entrada: EntradaMovimiento) {
  const r = esquemaMovimiento.safeParse(entrada);
  return r.success ? { ok: true as const, movimiento: r.data } : { ok: false as const, error: r.error.issues[0].message };
}

/** Lee un FormData de formulario de movimiento (campos con los mismos nombres de columna). */
export function movimientoDesdeFormulario(datos: FormData) {
  const v = (k: string) => {
    const x = datos.get(k);
    return typeof x === "string" ? x : undefined;
  };
  return validarMovimiento({
    tipo: v("tipo") as EntradaMovimiento["tipo"],
    fecha: v("fecha") ?? "",
    monto: v("monto") ?? "",
    account_id: v("account_id") ?? "",
    cuenta_destino_id: v("cuenta_destino_id"),
    category_id: v("category_id"),
    member_id: v("member_id"),
    tax_tag_id: v("tax_tag_id"),
    comercio: v("comercio"),
    nota: v("nota"),
    ambito: (v("ambito") || undefined) as EntradaMovimiento["ambito"],
  });
}
