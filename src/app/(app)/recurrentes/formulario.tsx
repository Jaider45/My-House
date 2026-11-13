"use client";

import { useActionState, useState } from "react";
import { Campo, Selector } from "@/components/ui";
import Link from "next/link";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana, useCerrarAlGuardar, useVentana } from "@/components/ui/ventana";
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
  const enVentana = !!useVentana();
  useCerrarAlGuardar(estado);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={regla?.id ?? ""} />
      <input type="hidden" name="tipo" value={tipo} />
      {!soloGasto && <SelectorTipo tipo={tipo} incluirTransferencia={false} onCambio={(t) => setTipo(t as "gasto" | "ingreso")} />}
      <Campo
        etiqueta={tipo === "ingreso" ? "¿Qué recibes?" : "¿Qué pagas?"}
        name="descripcion"
        defaultValue={regla?.descripcion}
        placeholder={tipo === "ingreso" ? "Salario, arriendo que te pagan…" : "Arriendo, internet, colegio, Netflix…"}
        required
        maxLength={120}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoMonto etiqueta="Monto" name="monto" valorInicial={regla?.monto} />
        <Campo
          etiqueta="Fecha de un pago"
          name="fecha_inicio"
          type="date"
          defaultValue={regla?.fecha_inicio ?? hoy}
          required
          ayuda="Desde ahí se repite. Solo se programan pagos de hoy en adelante."
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Selector key={tipo} etiqueta="Categoría" name="category_id" defaultValue={regla?.category_id ?? ""} required>
          <option value="">Elige…</option>
          {opcionesCategoria(categorias, tipo).map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta={tipo === "ingreso" ? "Entra a" : "Se paga desde"} name="account_id" defaultValue={regla?.account_id}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </div>
      <Selector etiqueta="Se repite" name="frecuencia" defaultValue={regla?.frecuencia ?? "mensual"}>
        {FRECUENCIAS.map((f) => (
          <option key={f} value={f}>
            {ETIQUETA_FRECUENCIA[f]}
          </option>
        ))}
      </Selector>
      {enVentana && tipo === "gasto" && (
        <p className="text-[13px] leading-[18px] text-tenue">
          ¿Es la cuota de un crédito?{" "}
          <Link href="/deudas?nuevo=1" className="font-bold text-tinta underline">
            Créala como deuda
          </Link>{" "}
          y así ves cuánto te falta.
        </p>
      )}
      <MensajeEstado estado={estado} />
      <PieVentana>{regla ? "Guardar cambios" : tipo === "ingreso" ? "Guardar ingreso fijo" : "Guardar pago fijo"}</PieVentana>
    </form>
  );
}
