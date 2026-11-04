// Service worker de My House.
// - Navegación: siempre red; sin conexión muestra /sin-conexion.
// - Archivos estáticos con hash (/_next/static, /iconos): caché primero.
// - Nunca guarda en caché páginas ni datos: la información financiera no se queda en el dispositivo.
const VERSION = "v1";
const CACHE = `my-house-${VERSION}`;
const PRECARGA = ["/sin-conexion", "/iconos/icono-192.png", "/iconos/icono.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith("my-house-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    evento.respondWith(fetch(request).catch(() => caches.match("/sin-conexion")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/iconos/")) {
    evento.respondWith(
      caches.match(request).then(
        (guardado) =>
          guardado ||
          fetch(request).then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(CACHE).then((c) => c.put(request, copia));
            }
            return respuesta;
          }),
      ),
    );
  }
});
