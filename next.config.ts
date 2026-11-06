import type { NextConfig } from "next";

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

export default nextConfig;
