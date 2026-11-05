import { Suspense } from "react";
import { ColaSinConexion } from "@/components/cola-sin-conexion";
import { BarraNavegacion, Navegacion } from "./navegacion";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1">
      <Suspense fallback={<BarraNavegacion ruta={null} />}>
        <Navegacion />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 pt-4 pb-32 md:px-6 md:pt-5 lg:px-8 lg:pt-6 lg:pb-12 xl:px-10 xl:pt-7 xl:pb-16">
        <ColaSinConexion />
        {children}
      </main>
    </div>
  );
}
