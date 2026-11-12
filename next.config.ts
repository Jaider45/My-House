import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Content Security Policy fija (sin nonce: con nonce cada página se generaría entera por request y se perdería el
 * prerender parcial de cacheComponents). Va como encabezado estático: no cuesta nada por request.
 * Se publica primero como Report-Only (`CSP_MODO=activa` la vuelve obligatoria) para ver en la consola del
 * navegador qué bloquearía antes de activarla. Ver docs/mejoras.md §4.
 */
function politicaSeguridad(): string {
  const dev = process.env.NODE_ENV !== "production";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  const turnstile = "https://challenges.cloudflare.com";
  // Errores y trazas del navegador van directo a la ingesta de Sentry (origen del DSN).
  const sentry = process.env.NEXT_PUBLIC_SENTRY_DSN ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin : "";
  const google = process.env.NEXT_PUBLIC_GOOGLE_ACTIVO === "1" ? "https://accounts.google.com" : "";
  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline': Next inyecta scripts en línea para hidratar. Quitarlo exige hashes (SRI), nunca nonce.
    // 'unsafe-eval' solo en desarrollo (React lo usa para reconstruir pilas de llamadas).
    "script-src": ["'self'", "'unsafe-inline'", turnstile, ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, turnstile, sentry, ...(dev ? ["ws:"] : [])],
    "frame-src": [turnstile],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // El ingreso con Google (sin JavaScript) es un POST que redirige a Supabase y de ahí a Google.
    // Pagar el plan: la acción redirige al Web Checkout de Wompi (form-action también rige las redirecciones).
    "form-action": ["'self'", supabase, google, "https://checkout.wompi.co"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directivas)
    .map(([nombre, valores]) => [nombre, ...valores.filter(Boolean)].join(" "))
    .join("; ");
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Volver a una pantalla visitada hace menos de 30 s no consulta el servidor. Toda acción que guarda llama
    // revalidatePath, que vacía esta caché del navegador: lo propio se ve al instante; lo de otro miembro, ≤ 30 s.
    staleTimes: { dynamic: 30 },
    // Las pantallas no tienen esqueleto propio a propósito: al navegar React deja la anterior hasta que la nueva
    // llega (~100 ms) en vez de mostrar "Cargando…" y retenerlo 300 ms. Next lo reporta como navegación no
    // instantánea; solo se validan los segmentos que exporten `instant`.
    instantInsights: { validationLevel: "manual-warning" },
    // Comprobantes (fotos comprimidas en el navegador) y extractos en PDF: hasta 5 archivos de ~10 MB.
    serverActions: { bodySizeLimit: "30mb" },
    // src/proxy.ts pasa por todas las rutas y Next solo copia 10 MB del cuerpo: lo demás se corta sin aviso y la
    // acción falla con "Unexpected end of form". Debe ser ≥ bodySizeLimit.
    proxyClientMaxBodySize: "30mb",
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: process.env.CSP_MODO === "activa" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
            value: politicaSeguridad(),
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "my-house-kr",
  project: "my-house",
  // Sube los source maps (pilas legibles en producción) solo si hay SENTRY_AUTH_TOKEN; luego los borra del build.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  silent: !process.env.CI,
  // Check-ins de los crons de vercel.json (/api/avisos, /api/cobros): avisa si no corren o fallan.
  _experimental: { vercelCronsMonitoring: true },
});
