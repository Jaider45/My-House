/**
 * Opciones comunes de Sentry (navegador, servidor y edge). Sin `NEXT_PUBLIC_SENTRY_DSN` el SDK no envía nada
 * (pruebas, desarrollo sin la variable).
 *
 * App financiera: no se mandan cuerpos de peticiones (formularios con montos), cabeceras, cookies (sesión de
 * Supabase), variables locales de las pilas, datos de consultas ni lo que va y viene de la IA (comprobantes).
 * Basta el error, la ruta y la pila.
 */
import type { init } from "@sentry/nextjs";

export const entornoSentry = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development";

export const opcionesSentry: Parameters<typeof init>[0] = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: entornoSentry,
  // Producción: 10 % de las trazas. Local y previews: todas, para ver la traza al probar.
  tracesSampleRate: entornoSentry === "production" ? 0.1 : 1.0,
  // Los logs (Sentry.logger) vienen activos por defecto desde la v11.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    stackFrameVariables: false,
    databaseQueryData: false,
    genAI: { inputs: false, outputs: false },
  },
};
