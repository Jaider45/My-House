"use client";

import { useActionState, useState } from "react";
import { AreaTexto, Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { opcionesCategoria } from "@/lib/categorias";
import type { Catalogos } from "@/lib/catalogos";
import { guardarMovimiento } from "./acciones";

export type MovimientoEditable = {
  id: string;
  tipo: "ingreso" | "gasto" | "transferencia";
  fecha: string;
  monto: number;
  account_id: string;
  cuenta_destino_id: string | null;
  category_id: string | null;
  member_id: string | null;
  tax_tag_id: string | null;
  comercio: string | null;
  nota: string | null;
};

const TIPOS = [
  { valor: "gasto", texto: "Gasto" },
  { valor: "ingreso", texto: "Ingreso" },
  { valor: "transferencia", texto: "Transferencia" },
] as const;

export function SelectorTipo({ tipo, onCambio, incluirTransferencia = true }: { tipo: string; onCambio: (t: MovimientoEditable["tipo"]) => void; incluirTransferencia?: boolean }) {
  return (
    <div role="radiogroup" className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
      {TIPOS.filter((t) => incluirTransferencia || t.valor !== "transferencia").map((t) => (
        <button
          key={t.valor}
          type="button"
          role="radio"
          aria-checked={tipo === t.valor}
          onClick={() => onCambio(t.valor)}
          className={`min-h-10 flex-1 rounded-lg text-sm font-semibold ${
            tipo === t.valor
              ? t.valor === "ingreso"
                ? "bg-emerald-600 text-white"
                : t.valor === "gasto"
                  ? "bg-red-600 text-white"
                  : "bg-white shadow dark:bg-zinc-800"
              : "text-zinc-500"
          }`}
        >
          {t.texto}
        </button>
      ))}
    </div>
  );
}

export function FormularioMovimiento({ catalogos, movimiento, hoy, miembroId }: { catalogos: Catalogos; movimiento?: MovimientoEditable; hoy: string; miembroId: string }) {
  const [estado, accion] = useActionState(guardarMovimiento, null);
  const [tipo, setTipo] = useState<MovimientoEditable["tipo"]>(movimiento?.tipo ?? "gasto");
  const cats = tipo === "transferencia" ? [] : opcionesCategoria(catalogos.categorias, tipo);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={movimiento?.id ?? ""} />
      <input type="hidden" name="tipo" value={tipo} />
      <SelectorTipo tipo={tipo} onCambio={setTipo} />
      <CampoMonto etiqueta="Monto" name="monto" valorInicial={movimiento?.monto} grande autoFocus={!movimiento} />
      <Campo etiqueta="Fecha" name="fecha" type="date" defaultValue={movimiento?.fecha ?? hoy} required />

      <Selector etiqueta={tipo === "transferencia" ? "Desde la cuenta" : "Cuenta"} name="account_id" defaultValue={movimiento?.account_id} required>
        {catalogos.cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </Selector>

      {tipo === "transferencia" ? (
        <Selector etiqueta="Hacia la cuenta" name="cuenta_destino_id" defaultValue={movimiento?.cuenta_destino_id ?? ""} required>
          <option value="">Elija…</option>
          {catalogos.cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      ) : (
        <Selector key={tipo} etiqueta="Categoría" name="category_id" defaultValue={movimiento?.category_id ?? ""} required>
          <option value="">Elija…</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </Selector>
      )}

      <Campo
        etiqueta={tipo === "ingreso" ? "Pagador (opcional)" : "Comercio o descripción (opcional)"}
        name="comercio"
        defaultValue={movimiento?.comercio ?? ""}
        maxLength={200}
      />

      <details className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950" open={Boolean(movimiento?.tax_tag_id || movimiento?.nota)}>
        <summary className="cursor-pointer text-sm font-semibold">Más detalles</summary>
        <div className="mt-3 space-y-3">
          <Selector etiqueta="Persona (a quién se atribuye)" name="member_id" defaultValue={movimiento?.member_id ?? miembroId}>
            <option value="">Del hogar (titular de la cuenta)</option>
            {catalogos.miembros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
                {m.es_dependiente ? " (dependiente)" : ""}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Etiqueta DIAN" name="tax_tag_id" defaultValue={movimiento?.tax_tag_id ?? ""}>
            <option value="">Ninguna</option>
            {catalogos.etiquetas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Selector>
          <AreaTexto etiqueta="Nota" name="nota" defaultValue={movimiento?.nota ?? ""} maxLength={1000} />
        </div>
      </details>

      <MensajeEstado estado={estado} />
      <BotonEnviar className="w-full">{movimiento ? "Guardar cambios" : "Guardar"}</BotonEnviar>
    </form>
  );
}
