import { EnlaceBoton } from "@/components/ui";
import { PaginaEstado } from "@/components/pagina-estado";

export const metadata = { title: "Página no encontrada" };

export default function NoEncontrada() {
  return (
    <PaginaEstado
      codigo="404"
      rotulo="Página no encontrada"
      titulo="Esta página no está en la casa"
      texto="Puede que el enlace esté viejo o que la página se haya movido. Tus cuentas y movimientos siguen intactos."
      acciones={
        <>
          <EnlaceBoton href="/" className="h-12 px-[22px]">
            Volver al inicio
          </EnlaceBoton>
          <EnlaceBoton href="/movimientos" variante="secundario" className="h-12 px-[22px]">
            Buscar un movimiento
          </EnlaceBoton>
        </>
      }
      pie="Código 404 · Si llegaste desde un enlace de My House, avísanos."
    />
  );
}
