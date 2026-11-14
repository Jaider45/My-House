"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana, Ventana, useCerrarAlGuardar } from "@/components/ui/ventana";
import { crearHogar } from "./acciones";

function Formulario() {
  const [estado, enviar] = useActionState(crearHogar, null);
  useCerrarAlGuardar(estado);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Campo etiqueta="Nombre del hogar" name="nombre" required maxLength={80} placeholder="Hogar Martínez Rojas" />
      <Campo etiqueta="Correo de quien lo administrará" name="correo" type="email" required placeholder="persona@correo.co" ayuda="Le llega una invitación de administrador (vence en 14 días). El hogar nace en Gratis." />
      <MensajeEstado estado={estado} />
      <PieVentana>Crear hogar</PieVentana>
    </form>
  );
}

/** Ventana «Crear hogar» (?nuevo=hogar): soporte o ventas abren un hogar para alguien. */
export function VentanaCrearHogar() {
  return (
    <Ventana titulo="Crear hogar" subtitulo="Para una persona que pidió ayuda para empezar" valor="hogar" ancho={520}>
      <Formulario />
    </Ventana>
  );
}
