"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Se muestra solo si falla el layout raíz (donde `error.tsx` no alcanza). Reemplaza todo el documento, así que trae
 * su propio <html> y estilos en línea: no importa `PaginaEstado` ni `marca.tsx` para no sumar JavaScript a la carga
 * normal de la app. Colores del sistema My House (`globals.css`).
 */
export default function ErrorGlobal({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);
  const ref = error && typeof error === "object" && "digest" in error ? String(error.digest) : null;
  const boton = {
    height: 48,
    padding: "0 22px",
    borderRadius: 8,
    border: "1px solid #143d33",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  } as const;

  return (
    <html lang="es-CO">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f2efea",
          color: "#143d33",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <title>Algo falló · My House</title>
        <main style={{ maxWidth: 460, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Error del servidor</p>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>Algo falló de nuestro lado</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: "26px", color: "#4a5652" }}>
            No es tu conexión ni algo que hiciste. Lo que registraste está guardado; intenta de nuevo en un momento.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <button type="button" onClick={() => retry()} style={{ ...boton, background: "#143d33", color: "#faf5ee" }}>
              Reintentar
            </button>
            {/* Recarga completa a propósito: el layout raíz falló, no hay enrutador en el que confiar. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ ...boton, background: "#ffffff", color: "#143d33" }}>
              Volver al inicio
            </a>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{ref ? `Código MH-500 · ref. ${ref}` : "Código MH-500"}</p>
        </main>
      </body>
    </html>
  );
}
