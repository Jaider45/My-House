import { Logo } from "@/components/marca";

/** Pantalla dividida del onboarding: panel de marca en verde monte (tablet en adelante) y el contenido a la derecha. */
export function MarcoMarca({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between gap-8 bg-monte p-14 text-arena md:flex">
        <Logo alto={40} negativo />
        <div className="space-y-4">
          <p className="text-[40px] leading-[44px] font-bold">Cuánto cuesta sostener la casa, sin adivinar.</p>
          <p className="max-w-md text-base text-sobre-monte">
            Ingresos, gastos y pagos fijos del hogar en un solo lugar, con el número mínimo del mes y la Renta DIAN
            al día.
          </p>
        </div>
        <p className="text-[13px] text-sobre-monte">Hecho en Colombia · tus datos son solo de tu hogar</p>
      </aside>
      <main className="flex justify-center px-4 pt-5 pb-6 md:items-start md:px-12 md:py-[72px]">
        <div className="flex w-full max-w-[440px] flex-col gap-6">
          <div className="md:hidden">
            <Logo alto={32} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
