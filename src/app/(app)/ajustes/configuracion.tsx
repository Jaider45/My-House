"use client";

import { useActionState, useState } from "react";
import { AreaTexto, Campo, Casilla, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { Interruptor } from "@/components/ui/interruptor";
import { PieVentana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { guardarDatosHogar, guardarTrm } from "./acciones";
import { solicitarDatos } from "../ayuda/acciones";

/** Nombre, ciudad y moneda del hogar (diseño «Configuración → Hogar y miembros»). */
export function FormularioDatosHogar({ nombre, ciudad, moneda, puede }: { nombre: string; ciudad: string | null; moneda: string; puede: boolean }) {
  const [estado, accion] = useActionState(guardarDatosHogar, null);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Campo etiqueta="Nombre del hogar" name="nombre" defaultValue={nombre} required maxLength={80} disabled={!puede} />
        <Campo etiqueta="Ciudad" name="ciudad" defaultValue={ciudad ?? ""} maxLength={60} placeholder="Bogotá" disabled={!puede} />
        <Selector etiqueta="Moneda" disabled defaultValue={moneda}>
          <option value="COP">Peso colombiano (COP)</option>
        </Selector>
      </div>
      {puede && (
        <div className="flex flex-wrap items-center gap-3">
          <BotonEnviar variante="secundario" pendiente="Guardando…">
            Guardar
          </BotonEnviar>
          <MensajeEstado estado={estado} />
        </div>
      )}
    </form>
  );
}

/** «Actualizar TRM a diario» o una TRM fija del hogar. */
export function FormularioTrm({ auto, manual, puede }: { auto: boolean; manual: number | null; puede: boolean }) {
  const [estado, accion] = useActionState(guardarTrm, null);
  const [activo, setActivo] = useState(auto);
  return (
    <form action={accion} className="flex flex-col gap-3">
      <Interruptor name="auto" titulo="Actualizar TRM a diario" texto="La oficial de la Superintendencia Financiera, cada mañana" defaultChecked={auto} alCambiar={setActivo}>
        {null}
      </Interruptor>
      {!activo && <Campo etiqueta="TRM que quieres usar" name="manual" inputMode="decimal" defaultValue={manual ? String(manual).replace(".", ",") : ""} placeholder="3.900" disabled={!puede} />}
      {puede && (
        <div className="flex flex-wrap items-center gap-3">
          <BotonEnviar variante="secundario" pendiente="Guardando…">
            Guardar TRM
          </BotonEnviar>
          <MensajeEstado estado={estado} />
        </div>
      )}
    </form>
  );
}

const TEXTOS = {
  consulta: { boton: "Enviar solicitud", detalle: "Cuéntanos qué necesitas saber o qué quieres corregir." },
  revocatoria: { boton: "Revocar la autorización", detalle: "Si revocas la autorización, no podremos seguir guardando los datos del hogar y tu cuenta se cerrará." },
  supresion: { boton: "Eliminar mi cuenta", detalle: "Borramos tu cuenta y tus datos. En los hogares que compartes, sales del hogar y los datos se quedan con las demás personas." },
} as const;

/** Solicitud de privacidad (Ley 1581): consulta o reclamo, revocatoria o supresión. Responde el equipo en el plazo legal. */
export function FormularioPrivacidad({ tipo }: { tipo: keyof typeof TEXTOS }) {
  const [estado, accion] = useActionState(solicitarDatos, null);
  useCerrarAlGuardar(estado);
  const t = TEXTOS[tipo];
  return (
    <form action={accion} className="flex flex-col gap-4">
      {tipo === "consulta" ? (
        <Selector etiqueta="Quiero" name="tipo" defaultValue="consulta">
          <option value="consulta">Saber qué datos tienen de mí</option>
          <option value="actualizacion">Corregir mis datos</option>
          <option value="reclamo">Hacer un reclamo sobre mis datos</option>
        </Selector>
      ) : (
        <input type="hidden" name="tipo" value={tipo} />
      )}
      <p className="text-sm text-cuerpo">{t.detalle}</p>
      <AreaTexto etiqueta={tipo === "consulta" ? "Detalle" : "¿Quieres contarnos por qué? (opcional)"} name="detalle" maxLength={2000} rows={3} />
      {tipo === "supresion" && <Casilla etiqueta="Entiendo que se borran mi cuenta y mis datos, y que no se puede deshacer" name="confirmo" />}
      {tipo === "revocatoria" && <input type="hidden" name="confirmo" value="on" />}
      <p className="text-[13px] text-tenue">Respondemos consultas en máximo 10 días hábiles y reclamos en 15. Te escribimos al correo de tu cuenta.</p>
      <MensajeEstado estado={estado} />
      <PieVentana variante={tipo === "consulta" ? undefined : "peligro"}>{t.boton}</PieVentana>
    </form>
  );
}
