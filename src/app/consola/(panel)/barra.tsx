"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icono, Logo, type NombreIcono } from "@/components/marca";
import { cx } from "@/components/ui";

/** Secciones del diseño Admin SaaS. Las que no tienen `href` llegan en la fase indicada del roadmap. */
const SECCIONES: { texto: string; icono: NombreIcono; href?: string; fase?: string }[] = [
  { texto: "Panel general", icono: "resumen", href: "/consola" },
  { texto: "Analítica", icono: "meta", fase: "S4" },
  { texto: "Hogares", icono: "casa", href: "/consola/hogares" },
  { texto: "Usuarios", icono: "familia", href: "/consola/usuarios" },
  { texto: "Suscripciones y cobros", icono: "cuentas", href: "/consola/cobros" },
  { texto: "Planes y cupones", icono: "ahorro", href: "/consola/planes" },
  { texto: "Contadores", icono: "declaracion-renta", fase: "S5" },
  { texto: "Soporte", icono: "alertas", fase: "S7" },
  { texto: "Parámetros DIAN", icono: "deducciones", fase: "S6" },
  { texto: "Catálogos", icono: "documentos", fase: "S6" },
  { texto: "IA y automatizaciones", icono: "conectividad", fase: "S6" },
  { texto: "Comunicaciones", icono: "servicios", fase: "S4" },
  { texto: "Equipo y permisos", icono: "certificados", href: "/consola/equipo" },
  { texto: "Privacidad y auditoría", icono: "documentos", href: "/consola/privacidad" },
  { texto: "Integraciones", icono: "conectividad", href: "/consola/integraciones" },
  { texto: "Sistema", icono: "configuracion", fase: "S8" },
];

const activa = (ruta: string | null, href: string) => ruta !== null && (href === "/consola" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`));

function Pendiente() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cx("pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-teja transition-opacity", pending ? "animate-pulse opacity-100 delay-150" : "opacity-0")}
    />
  );
}

type Lugar = "lateral" | "fila";

/** Navegación con la sección activa (usePathname: va detrás de <Suspense>). */
export function NavegacionConsola({ lugar }: { lugar: Lugar }) {
  return <BarraConsola lugar={lugar} ruta={usePathname()} />;
}

/** Barra lateral (laptop: solo íconos; escritorio: completa) o, en pantallas chicas, fila desplazable arriba. */
export function BarraConsola({ lugar, ruta }: { lugar: Lugar; ruta: string | null }) {
  if (lugar === "fila") return <Fila ruta={ruta} />;
  return (
    <div className="sticky top-0 hidden h-dvh shrink-0 py-4 pl-4 lg:flex">
        <aside
          aria-label="Navegación de la consola"
          className="flex w-[72px] flex-col items-center gap-6 overflow-y-auto rounded-2xl border border-borde bg-elevada px-3 py-6 xl:w-[280px] xl:items-stretch xl:px-4"
        >
          <Link href="/consola" className="flex min-h-10 items-center xl:px-2" aria-label="Panel general">
            <span className="xl:hidden">
              <Logo forma="isotipo" alto={32} />
            </span>
            <span className="hidden xl:block">
              <Logo alto={32} />
            </span>
          </Link>
          <nav className="flex flex-col">
            {SECCIONES.map((s) => {
              const clase = "flex h-10 w-10 items-center justify-center gap-3 rounded-lg text-[15px] xl:w-full xl:justify-start xl:px-3";
              if (!s.href)
                return (
                  <span key={s.texto} title={`${s.texto}: llega en la fase ${s.fase}`} aria-disabled className={cx(clase, "cursor-default text-tenue opacity-60")}>
                    <Icono nombre={s.icono} tamano={20} acento={false} />
                    <span className="sr-only xl:not-sr-only xl:flex-1">{s.texto}</span>
                    <span className="hidden text-[11px] font-semibold xl:inline">{s.fase}</span>
                  </span>
                );
              const esta = activa(ruta, s.href);
              return (
                <Link
                  key={s.texto}
                  href={s.href}
                  title={s.texto}
                  aria-current={esta ? "page" : undefined}
                  className={cx(clase, esta ? "bg-seleccion font-semibold text-tinta" : "text-cuerpo hover:text-tinta")}
                >
                  <Icono nombre={s.icono} tamano={20} relleno={esta} />
                  <span className="sr-only xl:not-sr-only">{s.texto}</span>
                  <Pendiente />
                </Link>
              );
            })}
          </nav>
        </aside>
    </div>
  );
}

function Fila({ ruta }: { ruta: string | null }) {
  const disponibles = SECCIONES.filter((s) => s.href);
  return (
      <nav aria-label="Navegación de la consola" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {disponibles.map((s) => {
          const esta = activa(ruta, s.href!);
          return (
            <Link
              key={s.texto}
              href={s.href!}
              aria-current={esta ? "page" : undefined}
              className={cx("inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm", esta ? "border-monte bg-seleccion font-semibold" : "border-borde bg-elevada text-cuerpo")}
            >
              <Icono nombre={s.icono} tamano={16} relleno={esta} />
              {s.texto}
            </Link>
          );
        })}
      </nav>
  );
}
