import Link from "next/link";
import { Logo } from "@/components/marca";

/** Página de estado (404, error, sin conexión): número grande de fondo, isotipo, mensaje y acciones. */
export function PaginaEstado({
  codigo,
  rotulo,
  titulo,
  texto,
  acciones,
  pie,
}: {
  codigo?: string;
  rotulo: string;
  titulo: string;
  texto: string;
  acciones: React.ReactNode;
  pie?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-pagina">
      <header className="flex items-center justify-between p-4 md:px-12 md:py-7">
        <Link href="/" aria-label="Ir al inicio de My House">
          <Logo alto={32} />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pt-2 pb-10 md:px-12 md:pb-24">
        <div className="flex w-full max-w-[560px] flex-col items-center gap-5 text-center">
          <div className="relative flex h-[150px] w-[260px] items-end justify-center md:h-[230px] md:w-[420px]">
            {codigo && (
              <span aria-hidden className="absolute inset-x-0 top-0 text-[120px] leading-none font-bold tracking-[-0.02em] text-borde md:text-[200px]">
                {codigo}
              </span>
            )}
            <div className="relative rounded-[28px] border border-borde bg-elevada p-5">
              <span className="md:hidden">
                <Logo forma="isotipo" alto={64} />
              </span>
              <span className="hidden md:block">
                <Logo forma="isotipo" alto={96} />
              </span>
            </div>
          </div>
          <p className="text-xs leading-4 font-bold tracking-[0.12em] uppercase">{rotulo}</p>
          <h1 className="text-[28px] leading-[1.15] font-bold md:text-[40px]">{titulo}</h1>
          <p className="max-w-[460px] text-[17px] leading-[26px] text-cuerpo">{texto}</p>
          <div className="flex w-full flex-wrap justify-center gap-3">{acciones}</div>
          {pie && <p className="text-[13px] text-tenue">{pie}</p>}
        </div>
      </main>
    </div>
  );
}
