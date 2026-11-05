import { Suspense } from "react";
import { Aviso, Cargando, EnlaceBoton, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { hoy } from "@/lib/fechas";
import { FormularioMovimiento } from "../formulario";

export const metadata = { title: "Nuevo movimiento" };

export default function Nuevo() {
  return (
    <>
      <Titulo>Nuevo movimiento</Titulo>
      <Tarjeta>
        <Suspense fallback={<Cargando compacto />}>
          <Contenido />
        </Suspense>
      </Tarjeta>
    </>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return <Aviso>Su rol es de solo lectura.</Aviso>;
  const catalogos = await cargarCatalogos(ctx);
  if (!catalogos.cuentas.length) {
    return (
      <div className="space-y-3">
        <Aviso tipo="info">Primero cree una cuenta (banco, efectivo o tarjeta).</Aviso>
        <EnlaceBoton href="/cuentas" className="w-full">
          Crear cuenta
        </EnlaceBoton>
      </div>
    );
  }
  return <FormularioMovimiento catalogos={catalogos} hoy={hoy()} miembroId={ctx.miembro.id} />;
}
