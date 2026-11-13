"use client";

import { useActionState } from "react";
import { AreaTexto, Campo, Selector } from "@/components/ui";
import { MensajeEstado } from "@/components/ui/estado";
import { Interruptor } from "@/components/ui/interruptor";
import { PieVentana, Ventana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { AUDIENCIAS, CATEGORIAS_ENLACE, ESTADOS_ALIADO, ETIQUETAS_OFERTA, LUGARES_ENLACE, LUGARES_OFERTA, TIPOS_ALIADO } from "@/lib/ofertas/constantes";
import { guardarAliado, guardarEnlace, guardarOferta } from "./acciones";

export type Oferta = {
  id: string;
  titulo: string;
  texto: string;
  etiqueta: string;
  boton_texto: string | null;
  boton_url: string | null;
  lugar: string;
  audiencia: string;
  desde: string;
  hasta: string | null;
  publicada: boolean;
};
export type Enlace = { id: string; titulo: string; fuente: string; url: string; categoria: string; lugar: string; orden: number; activo: boolean };
export type Aliado = { id: string; nombre: string; tipo: string; beneficio: string; cupon: string | null; url: string | null; estado: string; notas: string | null };

const opciones = (l: readonly (readonly [string, string])[]) =>
  l.map(([v, t]) => (
    <option key={v} value={v}>
      {t}
    </option>
  ));

function FormOferta({ o }: { o?: Oferta }) {
  const [estado, enviar] = useActionState(guardarOferta, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={o?.id ?? ""} />
      <Campo etiqueta="Título" name="titulo" defaultValue={o?.titulo} required maxLength={80} placeholder="Paga 10 meses y usa 12" />
      <AreaTexto etiqueta="Texto" name="texto" defaultValue={o?.texto} maxLength={240} rows={2} placeholder="Plan Familia anual a $199.000 hasta el 1 de diciembre." />
      <div className="grid gap-3 md:grid-cols-3">
        <Selector etiqueta="Etiqueta" name="etiqueta" defaultValue={o?.etiqueta ?? "Oferta"}>
          {ETIQUETAS_OFERTA.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </Selector>
        <Selector etiqueta="Dónde aparece" name="lugar" defaultValue={o?.lugar ?? "inicio"}>
          {opciones(LUGARES_OFERTA)}
        </Selector>
        <Selector etiqueta="A quién" name="audiencia" defaultValue={o?.audiencia ?? "todos"}>
          {opciones(AUDIENCIAS)}
        </Selector>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Texto del botón (opcional)" name="boton_texto" defaultValue={o?.boton_texto ?? ""} maxLength={30} placeholder="Ver" />
        <Campo etiqueta="Abre (ruta de la app o https://…)" name="boton_url" defaultValue={o?.boton_url ?? ""} placeholder="/ajustes/plan" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Desde" name="desde" type="date" defaultValue={o?.desde} />
        <Campo etiqueta="Hasta (vacío = siempre)" name="hasta" type="date" defaultValue={o?.hasta ?? ""} />
      </div>
      <Interruptor name="publicada" titulo="Publicada" texto="Apagada queda como borrador. Encendida aparece entre las fechas; quien la cierra no la vuelve a ver." defaultChecked={o?.publicada ?? false} />
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar oferta</PieVentana>
    </form>
  );
}

function FormEnlace({ e }: { e?: Enlace }) {
  const [estado, enviar] = useActionState(guardarEnlace, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={e?.id ?? ""} />
      <Campo etiqueta="Título" name="titulo" defaultValue={e?.titulo} required maxLength={90} placeholder="Descargar extractos en CSV · Bancolombia" />
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Dirección" name="url" defaultValue={e?.url} required placeholder="https://…" />
        <Campo etiqueta="Fuente" name="fuente" defaultValue={e?.fuente} maxLength={60} placeholder="Ayuda del banco" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Selector etiqueta="Categoría" name="categoria" defaultValue={e?.categoria ?? "otros"}>
          {opciones(CATEGORIAS_ENLACE)}
        </Selector>
        <Selector etiqueta="Dónde aparece" name="lugar" defaultValue={e?.lugar ?? "renta"}>
          {opciones(LUGARES_ENLACE)}
        </Selector>
        <Campo etiqueta="Orden" name="orden" type="number" min={1} max={999} defaultValue={e?.orden ?? 100} />
      </div>
      <Interruptor name="activo" titulo="Visible en la app" defaultChecked={e?.activo ?? true} />
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar enlace</PieVentana>
    </form>
  );
}

function FormAliado({ a, cupones }: { a?: Aliado; cupones: string[] }) {
  const [estado, enviar] = useActionState(guardarAliado, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={a?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Aliado" name="nombre" defaultValue={a?.nombre} required maxLength={80} />
        <Selector etiqueta="Tipo" name="tipo" defaultValue={a?.tipo ?? "otro"}>
          {opciones(TIPOS_ALIADO)}
        </Selector>
      </div>
      <Campo etiqueta="Beneficio para el hogar" name="beneficio" defaultValue={a?.beneficio} maxLength={160} placeholder="15 % en la declaración de renta" />
      <div className="grid gap-3 md:grid-cols-3">
        <Selector etiqueta="Cupón (para contar usos)" name="cupon" defaultValue={a?.cupon ?? ""}>
          <option value="">Sin cupón</option>
          {cupones.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Selector>
        <Campo etiqueta="Sitio web" name="url" defaultValue={a?.url ?? ""} placeholder="https://…" />
        <Selector etiqueta="Estado" name="estado" defaultValue={a?.estado ?? "negociacion"}>
          {opciones(ESTADOS_ALIADO)}
        </Selector>
      </div>
      <AreaTexto etiqueta="Notas internas" name="notas" defaultValue={a?.notas ?? ""} rows={3} maxLength={1000} />
      <MensajeEstado estado={estado} />
      <PieVentana>Guardar aliado</PieVentana>
    </form>
  );
}

/** Ventanas de crear y editar (se abren con ?nuevo=oferta, ?nuevo=oferta-<id>, enlace…, aliado…). */
export function VentanasOfertas({ ofertas, enlaces, aliados, cupones }: { ofertas: Oferta[]; enlaces: Enlace[]; aliados: Aliado[]; cupones: string[] }) {
  return (
    <>
      <Ventana titulo="Nueva oferta o aviso" valor="oferta" ancho={680}>
        <FormOferta />
      </Ventana>
      {ofertas.map((o) => (
        <Ventana key={o.id} titulo="Editar oferta" valor={`oferta-${o.id}`} ancho={680}>
          <FormOferta o={o} />
        </Ventana>
      ))}
      <Ventana titulo="Nuevo enlace de interés" valor="enlace" ancho={640}>
        <FormEnlace />
      </Ventana>
      {enlaces.map((e) => (
        <Ventana key={e.id} titulo="Editar enlace" valor={`enlace-${e.id}`} ancho={640}>
          <FormEnlace e={e} />
        </Ventana>
      ))}
      <Ventana titulo="Nuevo aliado" valor="aliado" ancho={640}>
        <FormAliado cupones={cupones} />
      </Ventana>
      {aliados.map((a) => (
        <Ventana key={a.id} titulo="Editar aliado" valor={`aliado-${a.id}`} ancho={640}>
          <FormAliado a={a} cupones={cupones} />
        </Ventana>
      ))}
    </>
  );
}
