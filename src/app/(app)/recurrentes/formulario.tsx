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
import { proximoDia } from "@/lib/deudas";
import { Interruptor } from "@/components/ui/interruptor";
import { SelectorTipo } from "../movimientos/formulario";
import { guardarRegla } from "./acciones";

export type Regla = {
  id: string;
  descripcion: string;
  monto: number;
  tipo: "gasto" | "ingreso" | "transferencia";
  account_id: string;
  category_id: string | null;
  frecuencia: Frecuencia;
  fecha_inicio: string;
  recordar?: boolean;
};

/** Las tres frecuencias del diseño; las demás quedan en «Otra». */
const PRINCIPALES: { valor: Frecuencia; texto: string }[] = [
  { valor: "mensual", texto: "Cada mes" },
  { valor: "bimestral", texto: "Cada 2 meses" },
  { valor: "anual", texto: "Cada año" },
];

type Props = { regla?: Regla; cuentas: CuentaOpcion[]; categorias: Categoria[]; hoy: string; /** Sin selector de tipo: solo gastos. */ soloGasto?: boolean };

export function FormularioRegla({ regla, cuentas, categorias, hoy, soloGasto }: Props) {
  const [estado, accion] = useActionState(guardarRegla, null);
  const [tipo, setTipo] = useState<"gasto" | "ingreso">(regla?.tipo === "ingreso" ? "ingreso" : "gasto");
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(regla?.frecuencia ?? "mensual");
  const [otra, setOtra] = useState(!PRINCIPALES.some((p) => p.valor === (regla?.frecuencia ?? "mensual")));
  // Mensual y cada 2 meses: basta el día del mes (la primera fecha es la próxima con ese día). Las demás: una fecha.
  const porDia = frecuencia === "mensual" || frecuencia === "bimestral";
  const [dia, setDia] = useState(Number((regla?.fecha_inicio ?? hoy).slice(8, 10)));
  const inicioPorDia = proximoDia(dia, hoy);
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
        {porDia ? (
          <>
            <Selector etiqueta="Día del mes" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Día {i + 1}
                </option>
              ))}
            </Selector>
            <input type="hidden" name="fecha_inicio" value={regla && Number(regla.fecha_inicio.slice(8, 10)) === dia ? regla.fecha_inicio : inicioPorDia} />
          </>
        ) : (
          <Campo etiqueta="Fecha de un pago" name="fecha_inicio" type="date" defaultValue={regla?.fecha_inicio ?? hoy} required ayuda="Desde ahí se repite." />
        )}
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
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] leading-[18px] font-semibold text-cuerpo">Se repite</span>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Se repite" className="inline-flex gap-1 rounded-[10px] bg-mosaico p-1">
            {PRINCIPALES.map((p) => (
              <button
                key={p.valor}
                type="button"
                role="radio"
                aria-checked={!otra && frecuencia === p.valor}
                onClick={() => {
                  setOtra(false);
                  setFrecuencia(p.valor);
                }}
                className={`h-9 rounded-lg px-3 text-sm font-semibold ${!otra && frecuencia === p.valor ? "bg-elevada shadow-sm" : "text-cuerpo"}`}
              >
                {p.texto}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={otra} onClick={() => setOtra(true)} className={`h-9 rounded-lg px-3 text-sm font-semibold ${otra ? "bg-elevada shadow-sm" : "text-cuerpo"}`}>
              Otra
            </button>
          </div>
          {otra && (
            <select aria-label="Otra frecuencia" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)} className="h-11 rounded-[10px] border border-control bg-elevada px-3 text-[15px]">
              {FRECUENCIAS.map((f) => (
                <option key={f} value={f}>
                  {ETIQUETA_FRECUENCIA[f]}
                </option>
              ))}
            </select>
          )}
        </div>
        <input type="hidden" name="frecuencia" value={frecuencia} />
      </div>
      {tipo === "gasto" && (
        <Interruptor
          name="recordar"
          titulo="Recordarme 3 días antes"
          texto="Por correo a quienes registran en el hogar (y por WhatsApp cuando lo conectes)"
          defaultChecked={regla?.recordar ?? true}
        />
      )}
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
