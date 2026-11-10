"use client";

import { useState, useTransition } from "react";
import { verCorreo } from "./acciones";

/** Correo enmascarado con «ver»: mostrarlo completo queda en la auditoría. */
export function VerCorreo({ usuario, enmascarado }: { usuario: string; enmascarado: string }) {
  const [correo, setCorreo] = useState<string>();
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-tenue">
      {correo ?? enmascarado}
      {!correo && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await verCorreo(usuario);
              if (r.email) setCorreo(r.email);
              else setError(r.error);
            })
          }
          className="font-semibold text-tinta underline-offset-2 hover:underline"
          title="Queda registrado en la auditoría"
        >
          {pendiente ? "…" : "ver"}
        </button>
      )}
      {error && <span className="text-error-tinta">{error}</span>}
    </span>
  );
}
