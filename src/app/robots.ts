import type { MetadataRoute } from "next";

/** App privada: ningún buscador debe rastrearla (ni `/ingresar` ni los enlaces de invitación). Estático: se genera en el build. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
