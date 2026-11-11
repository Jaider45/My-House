import { Suspense } from "react";
import { Cargando } from "@/components/ui";
import { ColaSinConexion } from "@/components/cola-sin-conexion";
import { AvisoSuspendido } from "@/components/aviso-suspendido";
import { AvisoAccesoSoporte } from "@/components/aviso-acceso-soporte";
import { BarraNavegacion, Navegacion } from "./navegacion";
import { SelectorHogar } from "./hogar-activo";
import { misHogares } from "./mis-hogares";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1">
      <Suspense fallback={<BarraNavegacion ruta={null} />}>
        <NavegacionConDatos />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 pt-4 pb-32 md:px-6 md:pt-5 lg:px-8 lg:pt-6 lg:pb-12 xl:px-10 xl:pt-7 xl:pb-16">
        <ColaSinConexion />
        <Suspense>
          <AvisoSuspendido />
          <AvisoAccesoSoporte />
          <SelectorHogar />
        </Suspense>
        {/* Único límite de carga de las pantallas: al navegar, React mantiene la pantalla anterior hasta que
            la nueva está lista (sin esqueleto ni la espera mínima de 300 ms que React impone al reemplazarlo). */}
        <Suspense fallback={<Cargando />}>{children}</Suspense>
      </main>
    </div>
  );
}

/** La barra suma «Clientes» para quien es contador de algún hogar (una consulta pequeña, cacheada por request). */
async function NavegacionConDatos() {
  const esContador = (await misHogares()).some((h) => h.rol === "contador");
  return <Navegacion extras={esContador ? [{ href: "/clientes", texto: "Clientes", icono: "certificados" }] : undefined} />;
}
