"use client";

import { useActionState, useState, useTransition } from "react";
import { Aviso, Boton, Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { iniciarDosPasos, type Inscripcion } from "@/app/(app)/ajustes/seguridad/acciones";
import { salirConsola } from "../ingresar/acciones";
import { activarDosPasosConsola } from "./acciones";

export function ActivarDosPasos({ siguiente }: { siguiente: string }) {
  const [inscripcion, setInscripcion] = useState<Inscripcion>();
  const [errorQr, setErrorQr] = useState<string>();
  const [generando, generar] = useTransition();
  const [estado, enviar] = useActionState(activarDosPasosConsola, null);

  const pedirQr = () =>
    generar(async () => {
      setErrorQr(undefined);
      const r = await iniciarDosPasos();
      if ("error" in r) setErrorQr(r.error);
      else setInscripcion(r.inscripcion);
    });

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[28px] leading-[34px] font-bold">Activa la verificación en dos pasos</h1>
        <p className="mt-1.5 text-[15px] leading-[22px] text-cuerpo">
          Es obligatoria para el equipo. Escanea el código con Google Authenticator, 1Password o Authy y escribe el
          código que te muestre.
        </p>
      </div>

      {!inscripcion ? (
        <>
          {errorQr && <Aviso>{errorQr}</Aviso>}
          <Boton type="button" className="h-12 w-full" onClick={pedirQr} disabled={generando}>
            {generando ? "Generando…" : "Generar código QR"}
          </Boton>
        </>
      ) : (
        <form action={enviar} className="flex flex-col gap-[18px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG generado por Supabase */}
          <img src={inscripcion.qr} alt="Código QR para la app autenticadora" className="mx-auto size-48 rounded-lg bg-white p-2" />
          <p className="text-center text-xs break-all text-tenue">Clave manual: {inscripcion.secreto}</p>
          <input type="hidden" name="factor" value={inscripcion.factorId} />
          <input type="hidden" name="siguiente" value={siguiente} />
          <Campo
            etiqueta="Código de 6 dígitos"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={7}
            required
            autoFocus
            className="[&_input]:text-center [&_input]:text-[22px] [&_input]:font-semibold [&_input]:tracking-[0.4em]"
          />
          {estado?.error && <Aviso>{estado.error}</Aviso>}
          <BotonEnviar className="h-12 w-full" pendiente="Verificando…">
            Activar y entrar
          </BotonEnviar>
        </form>
      )}

      <form action={salirConsola} className="self-center">
        <Boton type="submit" variante="fantasma" className="h-9 text-sm">
          Cerrar sesión
        </Boton>
      </form>
    </div>
  );
}
