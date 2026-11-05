"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono, Logo, type NombreIcono } from "@/components/marca";
import { cx } from "@/components/ui";

type Enlace = { href: string; texto: string; icono: NombreIcono; tambien?: string[] };

const LATERAL: Enlace[] = [
  { href: "/", texto: "Inicio", icono: "resumen" },
  { href: "/movimientos", texto: "Movimientos", icono: "cuentas", tambien: ["/rapido"] },
  { href: "/recurrentes", texto: "Pagos fijos", icono: "calendario" },
  { href: "/impuestos", texto: "Renta DIAN", icono: "declaracion-renta" },
  { href: "/importar", texto: "Importar extracto", icono: "documentos" },
  { href: "/ajustes", texto: "Configuración", icono: "configuracion", tambien: ["/cuentas", "/categorias"] },
];

const INFERIOR: Enlace[] = [
  LATERAL[0],
  LATERAL[1],
  LATERAL[2],
  LATERAL[3],
  { href: "/ajustes", texto: "Más", icono: "configuracion", tambien: ["/cuentas", "/categorias", "/importar"] },
];

const esActivo = (ruta: string | null, e: Enlace) =>
  ruta !== null && [e.href, ...(e.tambien ?? [])].some((h) => (h === "/" ? ruta === "/" : ruta === h || ruta.startsWith(`${h}/`)));

/** Navegación con el ítem activo según la ruta (usePathname: va detrás de <Suspense>). */
export function Navegacion() {
  return <BarraNavegacion ruta={usePathname()} />;
}

/** Barra lateral (laptop y escritorio) y barra inferior con botón de registrar (celular y tablet). */
export function BarraNavegacion({ ruta }: { ruta: string | null }) {
  return (
    <>
      <div className="sticky top-0 hidden h-dvh shrink-0 py-4 pl-4 lg:flex">
        <aside
          aria-label="Navegación principal"
          className="flex w-[72px] flex-col items-center gap-6 rounded-2xl border border-borde bg-elevada px-3 py-6 xl:w-[300px] xl:items-stretch xl:px-4"
        >
          <Link href="/" className="flex min-h-10 items-center xl:px-2" aria-label="Inicio">
            <span className="xl:hidden">
              <Logo forma="isotipo" alto={32} />
            </span>
            <span className="hidden xl:block">
              <Logo alto={32} />
            </span>
          </Link>
          <nav className="flex flex-col">
            {LATERAL.map((e) => {
              const activo = esActivo(ruta, e);
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  title={e.texto}
                  aria-current={activo ? "page" : undefined}
                  className={cx(
                    "flex h-10 w-10 items-center justify-center gap-3 rounded-lg text-[15px] xl:w-full xl:justify-start xl:px-3",
                    activo ? "bg-seleccion font-semibold text-tinta" : "text-cuerpo hover:text-tinta",
                  )}
                >
                  <Icono nombre={e.icono} tamano={20} relleno={activo} />
                  <span className="sr-only xl:not-sr-only">{e.texto}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>

      <Link
        href="/rapido"
        aria-label="Registrar"
        className="fixed right-5 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center rounded-full bg-teja text-white shadow-lg lg:hidden"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-borde bg-elevada px-1 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden"
      >
        {INFERIOR.map((e) => {
          const activo = esActivo(ruta, e);
          return (
            <Link
              key={e.href + e.texto}
              href={e.href}
              aria-current={activo ? "page" : undefined}
              className={cx(
                "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-xs leading-4",
                activo ? "bg-seleccion font-bold text-tinta" : "text-cuerpo",
              )}
            >
              {e.texto === "Más" ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="5" cy="12" r="1.2" />
                  <circle cx="12" cy="12" r="1.2" />
                  <circle cx="19" cy="12" r="1.2" />
                </svg>
              ) : (
                <Icono nombre={e.icono} tamano={22} relleno={activo} />
              )}
              {e.texto}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
