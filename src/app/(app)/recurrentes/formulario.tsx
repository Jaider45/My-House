"use client";

import { useActionState, useState } from "react";
import { Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { opcionesCategoria, type Categoria } from "@/lib/categorias";
import type { CuentaOpcion } from "@/lib/catalogos";
import { ETIQUETA_FRECUENCIA, FRECUENCIAS, type Frecuencia } from "@/lib/recurrentes";
import { SelectorTipo } from "../movimientos/formulario";
import { guardarRegla } from "./acciones";

export type Regla = {
  id: string;
  descripcion: string;
  monto: number;
  tipo: "gasto" | "ingreso" | "transferencia";
  account_id: string;
  category_id: string;
  frecuencia: Frecuencia;
  fecha_inicio: string;
};

type Props = { regla?: Regla; cuentas: CuentaOpcion[]; categorias: Categoria[]; hoy: string; /** Sin selector de tipo: solo gastos. */ soloGasto?: boolean };

export function FormularioRegla({ regla, cuentas, categorias, hoy, soloGasto }: Props) {
  const [estado, accion] = useActionState(guardarRegla, null);
  const [tipo, setTipo] = useState<"gasto" | "ingreso">(regla?.tipo === "ingreso" ? "ingreso" : "gasto");
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={regla?.id ?? ""} />
      <input type="hidden" name="tipo" value={tipo} />
      {!soloGasto && <SelectorTipo tipo={tipo} incluirTransferencia={false} onCambio={(t) => setTipo(t as "gasto" | "ingreso")} />}
      <Campo etiqueta="Descripción" name="descripcion" defaultValue={regla?.descripcion} placeholder="Arriendo, colegio, Netflix…" required maxLength={120} />
      <CampoMonto etiqueta="Monto" name="monto" valorInicial={regla?.monto} />
      <Selector etiqueta="Frecuencia" name="frecuencia" defaultValue={regla?.frecuencia ?? "mensual"}>
        {FRECUENCIAS.map((f) => (
          <option key={f} value={f}>
            {ETIQUETA_FRECUENCIA[f]}
          </option>
        ))}
      </Selector>
      <Campo
        etiqueta="Fecha de un pago (inicio)"
        name="fecha_inicio"
        type="date"
        defaultValue={regla?.fecha_inicio ?? hoy}
        required
        ayuda="Se programan los pagos desde hoy en adelante, siguiendo esta fecha."
      />
      <Selector etiqueta="Cuenta" name="account_id" defaultValue={regla?.account_id}>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </Selector>
      <Selector key={tipo} etiqueta="Categoría" name="category_id" defaultValue={regla?.category_id ?? ""} required>
        <option value="">Elige…</option>
        {opcionesCategoria(categorias, tipo).map((c) => (
          <option key={c.id} value={c.id}>
            {c.etiqueta}
          </option>
        ))}
      </Selector>
      <MensajeEstado estado={estado} />
      <BotonEnviar className="w-full">{regla ? "Guardar cambios" : tipo === "ingreso" ? "Crear ingreso fijo" : "Crear pago fijo"}</BotonEnviar>
    </form>
  );
}
