"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoAjustes, IconoImpuestos, IconoInicio, IconoLista, IconoMas } from "@/components/iconos";

const ENLACES = [
  { href: "/", texto: "Inicio", Icono: IconoInicio },
  { href: "/movimientos", texto: "Movimientos", Icono: IconoLista },
  { href: "/rapido", texto: "Registrar", Icono: IconoMas, destacado: true },
  { href: "/impuestos", texto: "DIAN", Icono: IconoImpuestos },
  { href: "/ajustes", texto: "Más", Icono: IconoAjustes },
];

export function Navegacion() {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <ul className="mx-auto flex max-w-lg items-end justify-around">
        {ENLACES.map(({ href, texto, Icono, destacado }) => (
          <li key={href}>
            {destacado ? (
              <Link
                href={href}
                aria-label="Registrar gasto"
                className="-mt-5 mb-1 flex size-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg ring-4 ring-white dark:ring-zinc-950"
              >
                <Icono className="size-7" />
              </Link>
            ) : (
              <Link
                href={href}
                aria-current={activo(href) ? "page" : undefined}
                className={`flex min-w-16 flex-col items-center gap-0.5 py-2 text-[11px] ${
                  activo(href) ? "font-semibold text-teal-700" : "text-zinc-500"
                }`}
              >
                <Icono />
                {texto}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
