import Link from "next/link";
import { cx } from "@/components/ui";

const PESTANAS = [
  { href: "/ajustes", texto: "Resumen" },
  { href: "/ajustes/hogar", texto: "Hogar" },
  { href: "/ajustes/miembros", texto: "Miembros" },
  { href: "/categorias", texto: "Categorías" },
  { href: "/ajustes/seguridad", texto: "Seguridad" },
] as const;

/** Pestañas de Configuración en píldoras (con desplazamiento horizontal en celular). */
export function PestanasConfiguracion({ actual }: { actual: (typeof PESTANAS)[number]["href"] }) {
  return (
    <nav aria-label="Secciones de configuración" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:mb-5 md:flex-wrap md:px-0">
      {PESTANAS.map((p) => {
        const activa = actual === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={cx(
              "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap",
              activa ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico",
            )}
          >
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
