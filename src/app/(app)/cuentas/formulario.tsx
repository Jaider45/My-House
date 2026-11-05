"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Campo, Selector, cx } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
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
};

const TIPOS: { valor: Cuenta["tipo"] | "credito"; texto: string; icono: NombreIcono }[] = [
  { valor: "banco", texto: "Cuenta bancaria", icono: "cuentas" },
  { valor: "tarjeta", texto: "Tarjeta de crédito", icono: "egresos" },
  { valor: "billetera", texto: "Billetera digital", icono: "conectividad" },
  { valor: "efectivo", texto: "Efectivo", icono: "ingresos" },
  { valor: "credito", texto: "Crédito o préstamo", icono: "deducciones" },
];

export function FormularioCuenta({ cuenta, titulares }: { cuenta?: Cuenta; titulares: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState(guardarCuenta, null);
  const [tipo, setTipo] = useState<Cuenta["tipo"] | "credito">(cuenta?.tipo ?? "banco");
  const tarjeta = tipo === "tarjeta";
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={cuenta?.id ?? ""} />
      <input type="hidden" name="tipo" value={tipo === "credito" ? "banco" : tipo} />
      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2">
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
          <Campo etiqueta="Entidad" name="entidad" defaultValue={cuenta?.entidad ?? ""} placeholder="Bancolombia, Davivienda, Nu, Nequi…" maxLength={60} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre para mostrar"
              name="nombre"
              defaultValue={cuenta?.nombre}
              placeholder={tarjeta ? "Visa Bancolombia" : tipo === "efectivo" ? "Efectivo" : "Ahorros Davivienda"}
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
                <label className="flex items-center gap-3 rounded-xl bg-mosaico p-3.5 text-sm">
                  <span className="flex-1">
                    <b>Recordarme el pago</b>
                    <br />
                    <span className="text-cuerpo">3 días antes, cada mes</span>
                  </span>
                  <input type="checkbox" name="recordar" defaultChecked className="interruptor" />
                </label>
              )}
            </>
          ) : (
            <CampoMonto etiqueta="Saldo de hoy" name="saldo" valorInicial={cuenta?.saldo_inicial} ayuda="Lo que hay hoy, antes de registrar movimientos." />
          )}
          <MensajeEstado estado={estado} />
          <BotonEnviar className="w-full">{cuenta ? "Guardar cambios" : "Guardar"}</BotonEnviar>
          <p className="text-[13px] text-tenue">
            Solo nombre y últimos 4 dígitos: nunca te pedimos claves. ¿Tienes el extracto?{" "}
            <Link href="/importar" className="font-semibold text-tinta underline">
              Impórtalo en PDF o CSV
            </Link>
            .
          </p>
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
