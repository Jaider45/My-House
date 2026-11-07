/** Descripción legible del navegador y el sistema: "Chrome en Android", "Safari en iPhone". */
export function describirDispositivo(ua: string | null | undefined): string {
  const u = ua ?? "";
  const navegador = /Edg\//.test(u)
    ? "Edge"
    : /OPR\/|Opera/.test(u)
      ? "Opera"
      : /SamsungBrowser\//.test(u)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(u)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(u)
            ? "Chrome"
            : /Safari\//.test(u)
              ? "Safari"
              : null;
  const sistema = /iPhone/.test(u)
    ? "iPhone"
    : /iPad/.test(u)
      ? "iPad"
      : /Android/.test(u)
        ? "Android"
        : /Windows/.test(u)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(u)
            ? "Mac"
            : /Linux/.test(u)
              ? "Linux"
              : null;
  if (navegador && sistema) return `${navegador} en ${sistema}`;
  return navegador ?? sistema ?? "Navegador desconocido";
}

/** Lugar aproximado por la IP, con las cabeceras que agrega Vercel. Sin ellas (local), null. */
export function lugarAproximado(cabeceras: { get(nombre: string): string | null }): string | null {
  const leer = (n: string) => {
    const v = cabeceras.get(n);
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const ciudad = leer("x-vercel-ip-city");
  const pais = leer("x-vercel-ip-country");
  const nombrePais = pais ? (new Intl.DisplayNames(["es"], { type: "region" }).of(pais) ?? pais) : null;
  return [ciudad, nombrePais].filter(Boolean).join(", ") || null;
}

const formatoMomento = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** "6 nov 2026, 7:31 a. m." en hora de Colombia. */
export function formatearMomento(fecha: Date): string {
  return formatoMomento.format(fecha).replace(/\./g, "").replace(" de ", " ").replace(" de ", " ").replace(/\b(a|p) m\b/, "$1. m.");
}
