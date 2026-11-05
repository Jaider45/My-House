import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "My House · Finanzas del hogar",
    short_name: "My House",
    description: "Gastos, costo de vida y renta del hogar en orden.",
    lang: "es-CO",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2efea",
    theme_color: "#143d33",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Registrar gasto",
        short_name: "Gasto",
        url: "/rapido",
        icons: [{ src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" }],
      },
      { name: "Movimientos", url: "/movimientos" },
    ],
  };
}
