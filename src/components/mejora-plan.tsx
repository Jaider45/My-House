import { Icono } from "@/components/marca";
import { EnlaceBoton } from "@/components/ui";

/** Lo que no incluye el plan del hogar: qué es y a dónde ir para tenerlo (Configuración → Plan). */
export function MejoraPlan({ titulo, children, compacto }: { titulo: string; children: React.ReactNode; compacto?: boolean }) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-control bg-elevada p-4 md:p-6">
      <span className="inline-flex items-center gap-2 rounded-full bg-mosaico px-3 py-1 text-xs font-bold">
        <Icono nombre="ahorro" tamano={14} /> Plan Familia
      </span>
      <div>
        <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">{titulo}</h2>
        <p className="mt-1 text-sm text-cuerpo">{children}</p>
      </div>
      <EnlaceBoton href="/ajustes/plan" variante={compacto ? "secundario" : "primario"} className="h-10">
        Ver planes
      </EnlaceBoton>
    </section>
  );
}
