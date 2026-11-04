"use client";

import { useActionState, useState } from "react";
import { Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { eliminarCuenta, guardarCuenta } from "./acciones";

export type Cuenta = {
  id: string;
  tipo: "banco" | "efectivo" | "tarjeta";
  nombre: string;
  saldo_inicial: number;
  titular_member_id: string | null;
};

export function FormularioCuenta({ cuenta, titulares }: { cuenta?: Cuenta; titulares: { id: string; nombre: string }[] }) {
  const [estado, accion] = useActionState(guardarCuenta, null);
  const [tipo, setTipo] = useState(cuenta?.tipo ?? "banco");
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={cuenta?.id ?? ""} />
      <Selector etiqueta="Tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Cuenta["tipo"])}>
        <option value="banco">Cuenta bancaria (ahorros o corriente)</option>
        <option value="efectivo">Efectivo</option>
        <option value="tarjeta">Tarjeta de crédito</option>
      </Selector>
      <Campo
        etiqueta="Nombre"
        name="nombre"
        defaultValue={cuenta?.nombre}
        placeholder={tipo === "tarjeta" ? "Visa Bancolombia" : tipo === "efectivo" ? "Billetera" : "Ahorros Davivienda"}
        required
        maxLength={80}
      />
      <CampoMonto
        etiqueta={tipo === "tarjeta" ? "Deuda actual" : "Saldo inicial"}
        name="saldo"
        valorInicial={cuenta?.saldo_inicial}
        ayuda={
          tipo === "tarjeta"
            ? "Lo que debe hoy en la tarjeta, antes de registrar movimientos."
            : "Lo que hay hoy, antes de registrar movimientos."
        }
      />
      <Selector etiqueta="Titular (para la DIAN)" name="titular" defaultValue={cuenta?.titular_member_id ?? ""}>
        <option value="">Sin titular</option>
        {titulares.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </Selector>
      <MensajeEstado estado={estado} />
      <BotonEnviar className="w-full">{cuenta ? "Guardar cambios" : "Crear cuenta"}</BotonEnviar>
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
