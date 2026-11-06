"use client";

import { useEffect, useRef } from "react";

type Turnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const LLAVE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let cargando: Promise<Turnstile> | null = null;
function cargarTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  cargando ??= new Promise((ok, falla) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? ok(window.turnstile) : falla(new Error("Turnstile no cargó")));
    s.onerror = () => {
      cargando = null;
      falla(new Error("Turnstile no cargó"));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

/**
 * Cloudflare Turnstile para ingreso, registro, recuperación y código. Casi siempre es invisible: solo aparece si
 * Cloudflare duda. Deja el token en el campo `captcha` del formulario. Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY no hace nada
 * (local y despliegues sin captcha). `reinicio`: cada vez que cambia se pide un token nuevo (son de un solo uso).
 */
export function Captcha({ reinicio }: { reinicio?: unknown }) {
  const caja = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!LLAVE || !caja.current) return;
    let vivo = true;
    cargarTurnstile()
      .then((t) => {
        if (!vivo || !caja.current) return;
        widget.current = t.render(caja.current, {
          sitekey: LLAVE,
          language: "es",
          appearance: "interaction-only",
          "response-field-name": "captcha",
          "refresh-expired": "auto",
        });
      })
      .catch(() => {
        // Sin el script (bloqueador, red) el servidor responderá que falta la verificación, con un mensaje claro.
      });
    return () => {
      vivo = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (widget.current && reinicio !== undefined) window.turnstile?.reset(widget.current);
  }, [reinicio]);

  if (!LLAVE) return null;
  return <div ref={caja} className="empty:hidden" />;
}
