import { PaginaEstado } from "@/components/pagina-estado";
import { clasesBoton } from "@/components/ui";

export const metadata = { title: "En mantenimiento" };

/** La muestra el proxy (con estado 503) mientras MANTENIMIENTO=1. Tus datos no se tocan. */
export default function Mantenimiento() {
  return (
    <PaginaEstado
      rotulo="Mantenimiento"
      titulo="Estamos mejorando My House"
      texto="Volvemos en unos minutos. Tus datos están seguros y nada de lo que registraste se pierde."
      acciones={
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/" className={clasesBoton("primario", "h-12 px-[22px]")}>
          Reintentar
        </a>
      }
    />
  );
}
