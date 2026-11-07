"use client";

import { useActionState } from "react";
import { Campo, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { MensajeEstado } from "@/components/ui/estado";
import { textoAviso } from "@/lib/recordatorios";
import { guardarRecordatorio } from "./acciones";

const pildora =
  "inline-flex h-9 cursor-pointer items-center rounded-full border border-control bg-elevada px-3 text-sm has-[:checked]:border-monte has-[:checked]:bg-monte has-[:checked]:text-arena has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teja";

function Opcion({ name, value, texto, tipo = "checkbox", marcada }: { name: string; value: string; texto: string; tipo?: "checkbox" | "radio"; marcada?: boolean }) {
  return (
    <label className={pildora}>
      <input type={tipo} name={name} value={value} defaultChecked={marcada} className="sr-only" />
      {texto}
    </label>
  );
}

export function FormularioRecordatorio() {
  const [estado, accion] = useActionState(guardarRecordatorio, null);
  return (
    <form action={accion} className="flex flex-col gap-3.5">
      <Campo etiqueta="¿Qué hay que pagar?" name="nombre" placeholder="Seguro del hogar" required maxLength={80} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha" name="fecha" type="date" required />
        <CampoMonto etiqueta="Monto (opcional)" name="monto" />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-cuerpo">Repetir</legend>
        <div className={cx("flex flex-wrap gap-2")}>
          <Opcion tipo="radio" name="repetir" value="una_vez" texto="Una vez" />
          <Opcion tipo="radio" name="repetir" value="mensual" texto="Cada mes" />
          <Opcion tipo="radio" name="repetir" value="anual" texto="Cada año" marcada />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-cuerpo">Avisar</legend>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 3, 7].map((d) => (
            <Opcion key={d} name="avisos" value={String(d)} texto={textoAviso(d)} marcada={d === 0 || d === 7} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-cuerpo">Por</legend>
        <div className="flex flex-wrap gap-2">
          <Opcion name="canales" value="whatsapp" texto="WhatsApp" />
          <Opcion name="canales" value="correo" texto="Correo" marcada />
          <Opcion name="canales" value="notificacion" texto="Notificación" marcada />
        </div>
      </fieldset>
      <MensajeEstado estado={estado} />
      <BotonEnviar>Guardar recordatorio</BotonEnviar>
    </form>
  );
}
