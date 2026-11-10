import { Suspense } from "react";
import { Logo } from "@/components/marca";
import { Cargando } from "@/components/ui";

/** Fondo verde monte con la marca en negativo y la etiqueta «Consola» (diseño AdminLogin). */
export default function LayoutAccesoConsola({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-monte px-4 py-12 sm:px-6">
      <div className="flex w-full max-w-[460px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Logo alto={34} negativo />
          <span className="inline-flex h-[26px] items-center rounded-full bg-teja px-3 text-xs font-bold tracking-[0.06em] text-[#1b130f] uppercase">
            Consola
          </span>
        </div>
        <div className="flex flex-col gap-[18px] rounded-[20px] bg-elevada p-6 text-tinta sm:p-8">
          <Suspense fallback={<Cargando compacto />}>{children}</Suspense>
        </div>
        <p className="text-center text-[13px] leading-5 text-sobre-monte">
          Solo personal autorizado de My House. Cada ingreso queda registrado con fecha, IP y dispositivo.
        </p>
      </div>
    </div>
  );
}
