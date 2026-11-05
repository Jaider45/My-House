import { PaginaEstado } from "@/components/pagina-estado";
import { clasesBoton } from "@/components/ui";

export const metadata = { title: "Sin conexión" };

export default function SinConexion() {
  return (
    <PaginaEstado
      rotulo="Sin conexión"
      titulo="Estás sin internet"
      texto="My House necesita internet para mostrar y guardar tus movimientos. Revisa la conexión e intenta de nuevo."
      acciones={
        // Recarga completa a propósito: esta página se sirve desde la caché del service worker.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/" className={clasesBoton("primario", "h-12 px-[22px]")}>
          Reintentar
        </a>
      }
    />
  );
}
