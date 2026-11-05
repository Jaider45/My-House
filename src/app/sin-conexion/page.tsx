export const metadata = { title: "Sin conexión" };

export default function SinConexion() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl" aria-hidden>
        📡
      </p>
      <h1 className="text-xl font-bold">Sin conexión</h1>
      <p className="text-sm text-tenue">
        My House necesita internet para mostrar y guardar sus movimientos. Revise la conexión e intente de nuevo.
      </p>
      {/* Recarga completa a propósito: esta página se sirve desde la caché del service worker. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-2 font-semibold text-tinta">
        Reintentar
      </a>
    </main>
  );
}
