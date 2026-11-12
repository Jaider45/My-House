"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Boton, EnlaceBoton } from "@/components/ui";
import { PaginaEstado } from "@/components/pagina-estado";

export default function ErrorDelServidor({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);
  const ref = error && typeof error === "object" && "digest" in error ? String(error.digest) : null;
  return (
    <PaginaEstado
      codigo="500"
      rotulo="Error del servidor"
      titulo="Algo falló de nuestro lado"
      texto="No es tu conexión ni algo que hiciste. Lo que registraste está guardado; intenta de nuevo en un momento."
      acciones={
        <>
          <EnlaceBoton href="/" className="h-12 px-[22px]">
            Volver al inicio
          </EnlaceBoton>
          <Boton variante="secundario" className="h-12 px-[22px]" onClick={() => retry()}>
            Reintentar
          </Boton>
        </>
      }
      pie={ref ? `Código MH-500 · ref. ${ref}` : "Código MH-500"}
    />
  );
}
