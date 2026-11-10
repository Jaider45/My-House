"use client";

import { useActionState } from "react";
import { AreaTexto, Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { enviarCampanaPrueba, guardarCampana, type EstadoCampana } from "./acciones";
import { SEGMENTOS, type Segmentos } from "./segmentos";

type Campana = {
  id: string;
  nombre: string;
  segmento: string;
  asunto: string;
  titulo: string;
  cuerpo: string;
  boton_texto: string | null;
  boton_url: string | null;
  programada_para: string | null;
};

/** Nueva campaña (o editar un borrador): mismo formulario para guardar, programar y enviarse una prueba. */
export function FormularioCampana({ campana, segmentos }: { campana?: Campana; segmentos: Segmentos }) {
  const [guardado, guardar] = useActionState(guardarCampana, null);
  const [prueba, probar] = useActionState(enviarCampanaPrueba, null);
  const programada = campana?.programada_para ? new Date(new Date(campana.programada_para).getTime() - 5 * 3600_000) : null;
  // Tras una acción React vacía los campos: se repueblan con lo último escrito (y si no, con la campaña o nada).
  const ultimo: EstadoCampana = prueba?.valores ? prueba : guardado;
  const v = (clave: string, porDefecto = "") => ultimo?.valores?.[clave] ?? porDefecto;

  return (
    <form key={campana?.id ?? "nueva"} className="flex flex-col gap-3">
      {campana && <input type="hidden" name="id" value={campana.id} />}
      <Campo etiqueta="Nombre de la campaña" name="nombre" required maxLength={80} defaultValue={v("nombre", campana?.nombre ?? "")} placeholder="Temporada de renta 2027" />
      <Selector etiqueta="Segmento" name="segmento" defaultValue={v("segmento", campana?.segmento ?? "gratis")} required>
        {SEGMENTOS.map((s) => {
          const n = segmentos[s.valor];
          return (
            <option key={s.valor} value={s.valor}>
              {s.texto} · {n ? `${n.con_permiso} de ${n.hogares} con permiso` : "—"}
            </option>
          );
        })}
      </Selector>
      <Campo etiqueta="Asunto" name="asunto" required maxLength={150} defaultValue={v("asunto", campana?.asunto ?? "")} />
      <Campo etiqueta="Título del correo" name="titulo" required maxLength={150} defaultValue={v("titulo", campana?.titulo ?? "")} />
      <AreaTexto etiqueta="Mensaje" name="cuerpo" required maxLength={2000} rows={4} defaultValue={v("cuerpo", campana?.cuerpo ?? "")} placeholder="Un párrafo corto: qué hay de nuevo y por qué les sirve." />
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Texto del botón" name="boton_texto" maxLength={40} defaultValue={v("boton_texto", campana?.boton_texto ?? "")} placeholder="Ver planes" />
        <Campo etiqueta="Enlace del botón" name="boton_url" maxLength={300} defaultValue={v("boton_url", campana?.boton_url ?? "")} placeholder="/ajustes/plan" />
        <Campo etiqueta="Fecha de envío" name="fecha" type="date" defaultValue={v("fecha", programada ? programada.toISOString().slice(0, 10) : "")} ayuda="Vacía = queda como borrador." />
        <Campo etiqueta="Hora (Bogotá)" name="hora" type="time" defaultValue={v("hora", programada ? programada.toISOString().slice(11, 16) : "")} ayuda="El envío diario corre a las 7:15 a. m." />
      </div>
      <MensajeEstado estado={guardado} />
      <MensajeEstado estado={prueba} />
      <div className="flex flex-wrap gap-2">
        <BotonEnviar formAction={guardar} pendiente="Guardando…">
          {campana ? "Guardar cambios" : "Guardar campaña"}
        </BotonEnviar>
        <BotonEnviar formAction={probar} variante="secundario" pendiente="Enviando…">
          Enviarme una prueba
        </BotonEnviar>
      </div>
      <p className="text-xs text-tenue">Solo llega a los administradores de hogares con «Novedades y promociones» activo, con enlace para darse de baja.</p>
    </form>
  );
}
