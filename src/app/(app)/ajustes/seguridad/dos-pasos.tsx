"use client";

import { useState, useTransition } from "react";
import { Aviso, Boton, Campo } from "@/components/ui";
import { confirmarDosPasos, desactivarDosPasos, iniciarDosPasos, type Inscripcion } from "./acciones";

/** `inicial`: factor verificado que la página ya consultó en el servidor (null = 2FA inactiva). */
export function DosPasos({ inicial }: { inicial: string | null }) {
  const [activo, setActivo] = useState<string | null>(inicial);
  const [inscripcion, setInscripcion] = useState<Inscripcion>();
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "ok"; texto: string }>();
  const [pendiente, iniciar] = useTransition();

  const activar = () =>
    iniciar(async () => {
      const r = await iniciarDosPasos();
      if ("error" in r) return setMensaje({ tipo: "error", texto: r.error });
      setMensaje(undefined);
      setInscripcion(r.inscripcion);
    });

  const confirmar = (datos: FormData) =>
    iniciar(async () => {
      if (!inscripcion) return;
      const { error } = await confirmarDosPasos(inscripcion.factorId, String(datos.get("codigo") ?? ""));
      if (error) return setMensaje({ tipo: "error", texto: error });
      setActivo(inscripcion.factorId);
      setInscripcion(undefined);
      setMensaje({ tipo: "ok", texto: "Verificación en dos pasos activada. Se te pedirá el código al ingresar." });
    });

  const desactivar = () =>
    iniciar(async () => {
      if (!activo) return;
      const { error } = await desactivarDosPasos(activo);
      if (error) return setMensaje({ tipo: "error", texto: error });
      setActivo(null);
      setMensaje({ tipo: "ok", texto: "Verificación en dos pasos desactivada." });
    });

  return (
    <div className="space-y-4">
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      {activo ? (
        <>
          <p className="text-sm">
            Estado: <strong className="text-ok-tinta">activa</strong>. Al ingresar se te pide el código de tu app
            autenticadora.
          </p>
          <Boton variante="peligro" onClick={desactivar} disabled={pendiente}>
            Desactivar
          </Boton>
        </>
      ) : inscripcion ? (
        <form action={confirmar} className="space-y-4">
          <p className="text-sm">
            1. Escanea el código con Google Authenticator, Microsoft Authenticator o similar.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG generado por Supabase */}
          <img src={inscripcion.qr} alt="Código QR para la app autenticadora" className="mx-auto size-48 rounded-lg bg-white p-2" />
          <p className="text-center text-xs break-all text-tenue">Clave manual: {inscripcion.secreto}</p>
          <p className="text-sm">2. Escribe el código de 6 dígitos que muestra la app.</p>
          <Campo etiqueta="Código" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
          <Boton type="submit" className="w-full" disabled={pendiente}>
            {pendiente ? "Verificando…" : "Confirmar"}
          </Boton>
        </form>
      ) : (
        <>
          <p className="text-sm">
            Estado: <strong>inactiva</strong>. Recomendada: protege tu información financiera aunque alguien conozca tu
            contraseña.
          </p>
          <Boton onClick={activar} disabled={pendiente}>
            {pendiente ? "Preparando…" : "Activar"}
          </Boton>
        </>
      )}
    </div>
  );
}
