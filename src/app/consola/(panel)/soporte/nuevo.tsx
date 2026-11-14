"use client";

import { useActionState } from "react";
import { AreaTexto, Campo, Selector } from "@/components/ui";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana } from "@/components/ui/ventana";
import { crearTicketConsola } from "./acciones";

/** Ticket abierto por el equipo (llegó por correo, teléfono o WhatsApp). Al crearlo se abre su conversación. */
export function FormularioNuevoTicket() {
  const [estado, enviar] = useActionState(crearTicketConsola, null);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Correo de la persona" name="correo" type="email" ayuda="Si tiene cuenta, el ticket queda en su hogar y ve las respuestas en Ayuda." />
        <Campo etiqueta="Nombre" name="nombre" maxLength={120} />
      </div>
      <Campo etiqueta="Asunto" name="asunto" required minLength={3} maxLength={120} />
      <div className="grid gap-3 md:grid-cols-3">
        <Selector etiqueta="Llegó por" name="canal" defaultValue="correo">
          <option value="correo">Correo</option>
          <option value="telefono">Teléfono</option>
          <option value="whatsapp">WhatsApp</option>
        </Selector>
        <Selector etiqueta="Tema" name="categoria" defaultValue="otro">
          <option value="cuenta">Cuenta</option>
          <option value="cobros">Cobros</option>
          <option value="importacion">Importación</option>
          <option value="ia">Asistente</option>
          <option value="renta">Renta</option>
          <option value="otro">Otro</option>
        </Selector>
        <Selector etiqueta="Prioridad" name="prioridad" defaultValue="normal">
          <option value="baja">Baja</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </Selector>
      </div>
      <AreaTexto etiqueta="Lo que pidió" name="mensaje" required rows={5} maxLength={5000} />
      <MensajeEstado estado={estado} />
      <PieVentana pendiente="Creando…">Crear ticket</PieVentana>
    </form>
  );
}
