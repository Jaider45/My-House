"use client";

import { useEffect, useState, useTransition } from "react";
import { Aviso, Boton, Campo } from "@/components/ui";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/acciones";

type Inscripcion = { factorId: string; qr: string; secreto: string };

export function DosPasos() {
  const [activo, setActivo] = useState<string | null | undefined>(undefined);
  const [inscripcion, setInscripcion] = useState<Inscripcion>();
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "ok"; texto: string }>();
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    crearClienteNavegador()
      .auth.mfa.listFactors()
      .then(({ data }) => setActivo(data?.totp.find((f) => f.status === "verified")?.id ?? null));
  }, []);

  const activar = () =>
    iniciar(async () => {
      const supabase = crearClienteNavegador();
      const { data: factores } = await supabase.auth.mfa.listFactors();
      for (const f of factores?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "My House" });
      if (error) return setMensaje({ tipo: "error", texto: mensajeError(error) });
      setInscripcion({ factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
    });

  const confirmar = (datos: FormData) =>
    iniciar(async () => {
      if (!inscripcion) return;
      const code = String(datos.get("codigo") ?? "").replace(/\D/g, "");
      const { error } = await crearClienteNavegador().auth.mfa.challengeAndVerify({ factorId: inscripcion.factorId, code });
      if (error) return setMensaje({ tipo: "error", texto: mensajeError(error) });
      setActivo(inscripcion.factorId);
      setInscripcion(undefined);
      setMensaje({ tipo: "ok", texto: "Verificación en dos pasos activada. Se te pedirá el código al ingresar." });
    });

  const desactivar = () =>
    iniciar(async () => {
      if (!activo) return;
      const { error } = await crearClienteNavegador().auth.mfa.unenroll({ factorId: activo });
      if (error) return setMensaje({ tipo: "error", texto: mensajeError(error) });
      setActivo(null);
      setMensaje({ tipo: "ok", texto: "Verificación en dos pasos desactivada." });
    });

  if (activo === undefined) return <p className="text-sm text-tenue">Consultando…</p>;

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
