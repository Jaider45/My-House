import Link from "next/link";
import { Logo } from "@/components/marca";
import { RESPONSABLE } from "@/lib/legal/responsable";

/** Documentos legales públicos (términos, política de datos): lectura cómoda, sin sesión ni datos de la base. */
export default function LayoutLegal({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-pagina">
      <header className="border-b border-borde bg-elevada">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" aria-label="My House, inicio">
            <Logo alto={28} />
          </Link>
          <nav className="flex gap-4 text-sm font-semibold">
            <Link href="/terminos" className="text-cuerpo hover:text-tinta">
              Términos
            </Link>
            <Link href="/privacidad" className="text-cuerpo hover:text-tinta">
              Privacidad
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <article className="space-y-4 text-[15px] leading-6 text-tinta">{children}</article>
        <p className="mt-12 border-t border-borde pt-6 text-sm text-tenue">
          ¿Preguntas? Escríbenos a{" "}
          <a className="font-semibold text-monte underline underline-offset-2" href={`mailto:${RESPONSABLE.correoDatos}`}>
            {RESPONSABLE.correoDatos}
          </a>
          .
        </p>
      </main>
    </div>
  );
}
