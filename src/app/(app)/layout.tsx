import { Suspense } from "react";
import { nombreRol } from "@/lib/hogar/constantes";
import { Cargando } from "@/components/ui";
import { ColaSinConexion } from "@/components/cola-sin-conexion";
import { AvisoSuspendido } from "@/components/aviso-suspendido";
import { AvisoAccesoSoporte } from "@/components/aviso-acceso-soporte";
import { AvisoLegal } from "@/components/aviso-legal";
import { Guia } from "@/components/guia/guia";
import { BarraNavegacion, Navegacion } from "./navegacion";
import { SelectorHogar } from "./hogar-activo";
import { misHogares } from "./mis-hogares";
import { obtenerContexto } from "@/lib/sesion";
import { hoy } from "@/lib/fechas";

export default function LayoutApp({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
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
          <AvisoLegal />
          <SelectorHogar />
        </Suspense>
        {/* Único límite de carga de las pantallas: al navegar, React mantiene la pantalla anterior hasta que
            la nueva está lista (sin esqueleto ni la espera mínima de 300 ms que React impone al reemplazarlo). */}
        <Suspense fallback={<Cargando />}>{children}</Suspense>
      </main>
      {/* Registrar abierto encima de la pantalla actual (ruta /rapido interceptada). */}
      {modal}
      {/* Guías interactivas: oscurece la pantalla e ilumina lo que toca usar (src/lib/guias). */}
      <Suspense>
        <Guia />
      </Suspense>
    </div>
  );
}


/**
 * La barra suma «Clientes» para quien es contador de algún hogar y muestra los contadores del diseño: comprobantes
 * por revisar (Movimientos) y pagos vencidos (Pagos fijos). Son dos conteos sin filas, en paralelo.
 */
async function NavegacionConDatos() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const [hogares, { count: revisar }, { count: vencidos }] = await Promise.all([
    misHogares(),
    ctx.supabase.from("receipts").select("id", { count: "exact", head: true }).eq("estado", "por_revisar"),
    ctx.supabase.from("transactions").select("id", { count: "exact", head: true }).eq("estado", "programado").eq("tipo", "gasto").lt("fecha", hoy()),
  ]);
  const esContador = hogares.some((h) => h.rol === "contador");
  return (
    <Navegacion
      extras={esContador ? [{ href: "/clientes", texto: "Clientes", icono: "certificados" }] : undefined}
      datos={{
        revisar: revisar ?? 0,
        vencidos: vencidos ?? 0,
        hogar: ctx.hogar.nombre,
        persona: ctx.miembro.nombre.split(/\s+/)[0] ?? "",
        rol: nombreRol(ctx.miembro.rol),
        puedeEditar: ctx.puedeEditar,
        puedeRegistrar: ctx.puedeRegistrar,
      }}
    />
  );
}
