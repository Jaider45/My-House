"use client";

import { useActionState, useState } from "react";
import { AreaTexto, Aviso, Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { MAX_CONTEXTO } from "@/lib/hogar/constantes";
import { guardarAsistente, guardarHogar } from "../acciones";

type Props = { nombre: string; ciudad: string; cuota: number; contexto: string; editable: boolean };

export function FormularioHogar({ nombre, ciudad, cuota, contexto, editable }: Props) {
  const [estado, accion] = useActionState(guardarHogar, null);
  const [texto, setTexto] = useState(contexto);
  return (
    <form action={accion} className="space-y-4">
      <fieldset disabled={!editable} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre del hogar" name="nombre" defaultValue={nombre} required maxLength={80} />
          <Campo etiqueta="Ciudad" name="ciudad" defaultValue={ciudad} maxLength={60} placeholder="Bogotá" />
        </div>
        <Campo
          etiqueta="Cuota de imprevistos (%)"
          name="cuota"
          type="number"
          inputMode="numeric"
          min={0}
          max={50}
          defaultValue={cuota}
          required
          ayuda="Se suma al número mínimo del hogar como colchón: porcentaje sobre fijos + variables esenciales."
        />
        <div className="space-y-1.5">
          <AreaTexto
            etiqueta="Contexto del hogar (opcional)"
            name="contexto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX_CONTEXTO}
            rows={4}
            placeholder="Ej.: Andrés es independiente (diseño) y Camila asalariada. Sofía (9) va al colegio y Tomás (4) al jardín. La abuela Rosa vive con nosotros y le pagamos la EPS. Tenemos un perro."
          />
          <p className="flex justify-between gap-3 text-[13px] leading-[18px] text-tenue">
            <span>El asistente de comprobantes lo usa para categorizar mejor. Las personas a cargo se agregan en Miembros.</span>
            <span className="shrink-0 tabular-nums">
              {texto.length}/{MAX_CONTEXTO}
            </span>
          </p>
        </div>
      </fieldset>
      <MensajeEstado estado={estado} />
      {editable && <BotonEnviar className="w-full">Guardar</BotonEnviar>}
    </form>
  );
}

type Proveedor = { valor: string; nombre: string; porDefecto: string; sugeridos: string[] };

export function FormularioAsistente({
  editable,
  disponibles,
  proveedor,
  modelo,
  efectiva,
  elegidoSinLlave,
}: {
  editable: boolean;
  disponibles: Proveedor[];
  proveedor: string;
  modelo: string;
  efectiva: string | null;
  elegidoSinLlave: string | null;
}) {
  const [estado, accion] = useActionState(guardarAsistente, null);
  const [elegido, setElegido] = useState(proveedor);
  const actual = disponibles.find((p) => p.valor === elegido);

  if (!disponibles.length) {
    return (
      <Aviso tipo="info">
        Este servidor no tiene llaves de IA. Quien administra el despliegue debe agregar <code>ANTHROPIC_API_KEY</code> (Claude) u{" "}
        <code>OPENAI_API_KEY</code> (GPT) en las variables de entorno.
      </Aviso>
    );
  }
  return (
    <form action={accion} className="space-y-4">
      {elegidoSinLlave && (
        <Aviso>
          Elegiste {elegidoSinLlave}, pero el servidor ya no tiene su llave: mientras tanto se usa {efectiva}.
        </Aviso>
      )}
      <fieldset disabled={!editable} className="space-y-4">
        <Selector etiqueta="Proveedor" name="proveedor" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          <option value="">Automático (lo que defina el servidor)</option>
          {disponibles.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.nombre}
            </option>
          ))}
        </Selector>
        {actual && (
          <>
            <Campo
              key={actual.valor}
              etiqueta="Modelo"
              name="modelo"
              list={`modelos-${actual.valor}`}
              defaultValue={proveedor === actual.valor ? modelo : ""}
              placeholder={actual.porDefecto}
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              ayuda="Vacío = el modelo por defecto. Debe leer imágenes y PDF; si el proveedor no lo reconoce, el asistente te lo dirá."
            />
            <datalist id={`modelos-${actual.valor}`}>
              {actual.sugeridos.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </>
        )}
      </fieldset>
      {efectiva && (
        <p className="text-sm text-cuerpo">
          En uso ahora: <b>{efectiva}</b>
        </p>
      )}
      <MensajeEstado estado={estado} />
      {editable && <BotonEnviar className="w-full">Guardar asistente</BotonEnviar>}
    </form>
  );
}
