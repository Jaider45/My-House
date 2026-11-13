"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Campo, Selector, cx } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { Interruptor } from "@/components/ui/interruptor";
import { eliminarCuenta, guardarCuenta } from "./acciones";

export type Cuenta = {
  id: string;
  tipo: "banco" | "efectivo" | "tarjeta" | "billetera";
  nombre: string;
  entidad: string | null;
  ultimos4: string | null;
  saldo_inicial: number;
  cupo: number | null;
  dia_corte: number | null;
  dia_pago: number | null;
  titular_member_id: string | null;
  subtipo?: "ahorros" | "corriente" | null;
};

type Eleccion = "ahorros" | "corriente" | "tarjeta" | "billetera" | "efectivo" | "credito";

/** Los seis tipos del diseño. Ahorros y corriente son cuentas de banco (`subtipo`). */
const TIPOS: { valor: Eleccion; texto: string; icono: NombreIcono }[] = [
  { valor: "ahorros", texto: "Ahorros", icono: "cuentas" },
  { valor: "corriente", texto: "Corriente", icono: "cuentas" },
  { valor: "tarjeta", texto: "Tarjeta de crédito", icono: "egresos" },
  { valor: "billetera", texto: "Billetera digital", icono: "conectividad" },
  { valor: "efectivo", texto: "Efectivo", icono: "ingresos" },
  { valor: "credito", texto: "Crédito o préstamo", icono: "deducciones" },
];

/** Entidades frecuentes en Colombia (sugerencias del campo Entidad). */
const ENTIDADES = ["Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Banco de Occidente", "Banco Popular", "Banco AV Villas", "Banco Caja Social", "Scotiabank Colpatria", "Itaú", "Banco Falabella", "Banco Pichincha", "Bancoomeva", "Nu", "Lulo Bank", "RappiPay", "Nequi", "Daviplata", "Dale!", "Movii", "Ualá"];

const NOMBRE_TIPO: Record<Eleccion, string> = { ahorros: "ahorros", corriente: "corriente", tarjeta: "tarjeta", billetera: "", efectivo: "", credito: "" };

export function FormularioCuenta({ cuenta, titulares, cuentasPago = [] }: { cuenta?: Cuenta; titulares: { id: string; nombre: string }[]; /** Desde dónde se paga la tarjeta (pago fijo). */ cuentasPago?: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState(guardarCuenta, null);
  useCerrarAlGuardar(estado);
  const inicial: Eleccion = cuenta ? (cuenta.tipo === "banco" ? (cuenta.subtipo ?? "ahorros") : cuenta.tipo) : "ahorros";
  const [tipo, setTipo] = useState<Eleccion>(inicial);
  const [entidad, setEntidad] = useState(cuenta?.entidad ?? "");
  const [nombre, setNombre] = useState(cuenta?.nombre ?? "");
  const [nombreTocado, setNombreTocado] = useState(!!cuenta);
  const tarjeta = tipo === "tarjeta";
  const banco = tipo === "ahorros" || tipo === "corriente";
  // Nombre sugerido mientras no lo escriban a mano: «Davivienda ahorros», «Tarjeta Bancolombia», «Nequi».
  const sugerido = tipo === "efectivo" ? "Efectivo" : tarjeta ? (entidad ? `Tarjeta ${entidad}` : "") : [entidad, NOMBRE_TIPO[tipo]].filter(Boolean).join(" ");
  const nombreVisible = nombreTocado ? nombre : sugerido;
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={cuenta?.id ?? ""} />
      <input type="hidden" name="tipo" value={banco || tipo === "credito" ? "banco" : tipo} />
      <input type="hidden" name="subtipo" value={banco ? tipo : ""} />
      <div role="radiogroup" aria-label="Tipo de cuenta" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            role="radio"
            aria-checked={tipo === t.valor}
            onClick={() => setTipo(t.valor)}
            className={cx(
              "flex min-h-12 items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold",
              tipo === t.valor ? "border-2 border-monte bg-seleccion" : "border border-control bg-elevada",
            )}
          >
            <Icono nombre={t.icono} tamano={20} />
            {t.texto}
          </button>
        ))}
      </div>

      {tipo === "credito" ? (
        <p className="rounded-xl bg-mosaico p-4 text-sm text-cuerpo">
          Los créditos y préstamos se llevan en{" "}
          <Link href="/deudas" className="font-semibold text-tinta underline">
            Deudas
          </Link>
          , con su saldo, cuotas y fecha límite.
        </p>
      ) : (
        <>
          {tipo !== "efectivo" && (
            <>
              <Campo etiqueta="Entidad" name="entidad" list="entidades" value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="Bancolombia, Davivienda, Nu, Nequi…" maxLength={60} autoComplete="off" />
              <datalist id="entidades">
                {ENTIDADES.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre para mostrar"
              name="nombre"
              value={nombreVisible}
              onChange={(e) => {
                setNombreTocado(true);
                setNombre(e.target.value);
              }}
              placeholder={tarjeta ? "Mastercard Davivienda" : tipo === "efectivo" ? "Efectivo" : "Davivienda ahorros"}
              required
              maxLength={80}
            />
            {tipo !== "efectivo" && <Campo etiqueta="Últimos 4 dígitos" name="ultimos4" defaultValue={cuenta?.ultimos4 ?? ""} inputMode="numeric" maxLength={4} pattern="\d{4}" />}
          </div>
          <Selector etiqueta="Titular (para la DIAN)" name="titular" defaultValue={cuenta?.titular_member_id ?? ""}>
            <option value="">Compartida</option>
            {titulares.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Selector>
          {tarjeta ? (
            <>
              <CampoMonto etiqueta="Cupo total" name="cupo" valorInicial={cuenta?.cupo ?? 0} />
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Día de corte" name="dia_corte" type="number" min={1} max={31} defaultValue={cuenta?.dia_corte ?? ""} />
                <Campo etiqueta="Día límite de pago" name="dia_pago" type="number" min={1} max={31} defaultValue={cuenta?.dia_pago ?? ""} />
              </div>
              <CampoMonto etiqueta="Deuda actual" name="saldo" valorInicial={cuenta?.saldo_inicial} ayuda="Lo que debes hoy en la tarjeta, antes de registrar movimientos." />
              {!cuenta && (
                <>
                  <Interruptor name="recordar" titulo="Recordarme el pago" texto="3 días antes del día límite, cada mes" defaultChecked />
                  {cuentasPago.length > 0 && (
                    <Interruptor name="pago_fijo" titulo="Crear pago fijo con la cuota" texto="Aparece en Pagos fijos cada mes, como transferencia a la tarjeta">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <CampoMonto etiqueta="Cuota de cada mes" name="cuota" />
                        <Selector etiqueta="Se paga desde" name="pago_desde" defaultValue={cuentasPago[0]?.id}>
                          {cuentasPago.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </Selector>
                      </div>
                    </Interruptor>
                  )}
                </>
              )}
            </>
          ) : (
            <CampoMonto etiqueta="Saldo de hoy" name="saldo" valorInicial={cuenta?.saldo_inicial} ayuda="Lo que hay hoy, antes de registrar movimientos." />
          )}
          {!cuenta && (
            <p className="text-[13px] text-tenue">
              ¿Tienes el extracto? Después de guardar puedes{" "}
              <Link href="/importar" className="font-semibold text-tinta underline">
                importar el PDF o CSV
              </Link>{" "}
              de esta cuenta.
            </p>
          )}
          <MensajeEstado estado={estado} />
          <PieVentana>{cuenta ? "Guardar cambios" : "Guardar cuenta"}</PieVentana>
        </>
      )}
    </form>
  );
}

export function BotonEliminarCuenta({ id }: { id: string }) {
  const [estado, accion] = useActionState(eliminarCuenta, null);
  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="peligro" pendiente="Eliminando…" className="w-full">
        Eliminar
      </BotonEnviar>
    </form>
  );
}
