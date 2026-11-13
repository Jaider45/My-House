"use client";

import { useState } from "react";
import { AreaTexto, Campo, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { Interruptor } from "@/components/ui/interruptor";
import { Markdown } from "@/lib/texto/markdown";
import { diffTexto } from "@/lib/texto/diff";
import { accionVersion } from "./acciones";

export type VersionEditable = {
  id: string;
  version: string;
  contenido: string;
  resumen: string;
  estado: "borrador" | "en_revision" | "aprobada" | "publicada";
  vigente_desde: string | null;
  pedir_aceptacion: boolean;
  avisar_correo: boolean;
  revision_correo: string | null;
};

type Vista = "editar" | "usuario" | "comparar";

/** Comparación con la versión vigente: párrafos nuevos en verde, quitados tachados. */
export function Comparacion({ antes, despues }: { antes: string; despues: string }) {
  const d = diffTexto(antes, despues).filter((p) => p.tipo !== "igual");
  if (!d.length) return <p className="text-sm text-tenue">No hay cambios frente a la versión vigente.</p>;
  return (
    <div className="flex flex-col gap-2">
      {d.map((p, i) => (
        <p key={i} className="rounded-lg bg-mosaico px-3 py-2 text-sm leading-6 whitespace-pre-wrap">
          {p.trozos.map((t, j) =>
            t.tipo === "mas" ? (
              <ins key={j} className="rounded bg-ok-fondo px-0.5 text-ok-tinta no-underline">
                {t.texto}
              </ins>
            ) : t.tipo === "menos" ? (
              <del key={j} className="rounded bg-error-fondo px-0.5 text-error-tinta">
                {t.texto}
              </del>
            ) : (
              <span key={j}>{t.texto}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

export function EditorVersion({
  v,
  documento,
  anterior,
  variables,
  hoy,
  puedeEditar,
}: {
  v: VersionEditable;
  documento: string;
  anterior: { version: string; contenido: string } | null;
  variables: Record<string, string>;
  hoy: string;
  puedeEditar: boolean;
}) {
  const [vista, setVista] = useState<Vista>("editar");
  const [texto, setTexto] = useState(v.contenido);
  const pestanas: [Vista, string][] = [
    ["editar", "Editar"],
    ["usuario", "Ver como usuario"],
    ...(anterior ? ([["comparar", `Comparar con v${anterior.version}`]] as [Vista, string][]) : []),
  ];
  return (
    <FormularioEstado accion={accionVersion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={v.id} />
      <input type="hidden" name="documento" value={documento} />
      <input type="hidden" name="version" value={v.version} />
      <input type="hidden" name="contenido" value={texto} />
      <div role="tablist" aria-label="Vista" className="inline-flex self-start rounded-[10px] bg-mosaico p-1">
        {pestanas.map(([k, t]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={vista === k}
            onClick={() => setVista(k)}
            className={cx("h-8 rounded-lg px-3 text-sm font-semibold", vista === k ? "bg-elevada shadow-sm" : "text-cuerpo")}
          >
            {t}
          </button>
        ))}
      </div>

      {vista === "editar" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">Texto</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            readOnly={!puedeEditar}
            rows={18}
            className="min-h-80 w-full rounded-lg border border-control bg-elevada p-3 font-mono text-[13px] leading-5 outline-none focus:border-monte focus:ring-2 focus:ring-monte/15"
          />
          <span className="text-[13px] text-tenue">
            «## Título», «- lista», «**negrita**» y «[texto](https://…)». Variables: {"{razon_social}"}, {"{identificacion}"}, {"{direccion}"}, {"{telefono}"},{" "}
            {"{correo_datos}"}, {"{correo_soporte}"} (salen de Ajustes de la plataforma → Empresa).
          </span>
        </label>
      )}
      {vista === "usuario" && (
        <div className="max-h-[560px] overflow-y-auto rounded-xl border border-borde p-4">
          <Markdown texto={texto} variables={variables} />
        </div>
      )}
      {vista === "comparar" && anterior && <Comparacion antes={anterior.contenido} despues={texto} />}

      <AreaTexto
        etiqueta="Resumen de cambios (se muestra al usuario)"
        name="resumen"
        defaultValue={v.resumen}
        maxLength={600}
        rows={3}
        readOnly={!puedeEditar}
      />
      <div className="flex flex-col gap-3">
        <Interruptor name="pedir_aceptacion" titulo="Pedir aceptación de nuevo a los usuarios" texto="Al entrar a la app verán el resumen y aceptarán para seguir." defaultChecked={v.pedir_aceptacion} />
        <Interruptor name="avisar_correo" titulo="Avisar por correo 10 días antes de que entre en vigencia" texto="A todas las personas con cuenta. Es un aviso obligatorio, no publicidad." defaultChecked={v.avisar_correo} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Entra en vigencia" name="vigente_desde" type="date" min={hoy} defaultValue={v.vigente_desde ?? ""} readOnly={!puedeEditar} />
        <Campo etiqueta="Correo del abogado" name="abogado" type="email" defaultValue={v.revision_correo ?? ""} placeholder="abogado@firma.co" readOnly={!puedeEditar} />
      </div>
      {puedeEditar && (
        <div className="flex flex-wrap gap-2">
          <BotonEnviar name="operacion" value="abogado" variante="secundario">
            {v.estado === "en_revision" ? "Reenviar al abogado" : "Enviar al abogado"}
          </BotonEnviar>
          <BotonEnviar name="operacion" value="guardar" variante="fantasma">
            Guardar borrador
          </BotonEnviar>
        </div>
      )}
    </FormularioEstado>
  );
}
