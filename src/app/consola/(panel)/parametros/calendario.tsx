"use client";

import { useActionState, useState } from "react";
import { Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { guardarCalendario } from "./acciones";

/** Pegar el calendario de la DIAN: el texto vive en el componente para no perderlo si la validación falla. */
export function EditorCalendario({ anios, textos, puede }: { anios: number[]; textos: Record<number, string>; puede: boolean }) {
  const [estado, enviar] = useActionState(guardarCalendario, null);
  const [anio, setAnio] = useState(anios[0]);
  const [texto, setTexto] = useState(textos[anios[0]] ?? "");
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Selector
        etiqueta="Año gravable"
        name="anio"
        value={anio}
        onChange={(e) => {
          const a = Number(e.target.value);
          setAnio(a);
          setTexto(textos[a] ?? "");
        }}
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a} (se declara en {a + 1})
          </option>
        ))}
      </Selector>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] leading-[18px] font-semibold text-cuerpo">Fechas por últimos dígitos de la cédula</span>
        <textarea
          name="calendario"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={!puede}
          rows={10}
          spellCheck={false}
          placeholder={`01-02 ${anio + 1}-08-12\n03-04 ${anio + 1}-08-13\n…\n99-00 ${anio + 1}-10-24`}
          className="rounded-lg border border-control bg-elevada px-3 py-2 font-mono text-[13px] text-tinta outline-none focus:border-monte"
        />
        <span className="text-[13px] text-tenue">Una línea por fecha, como la publica la DIAN. Deben quedar las 100 terminaciones (00 a 99).</span>
      </label>
      {puede && (
        <BotonEnviar variante="secundario" pendiente="Guardando…" className="self-start">
          Guardar calendario
        </BotonEnviar>
      )}
      <MensajeEstado estado={estado} />
    </form>
  );
}
