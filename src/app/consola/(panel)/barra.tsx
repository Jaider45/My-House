"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icono, Logo, type NombreIcono } from "@/components/marca";
import { cx } from "@/components/ui";

/** Grupos del diseño Admin SaaS (barra lateral). `insignia` = contador de la sección (ver `consola_insignias`). */
type Seccion = { texto: string; icono: NombreIcono; href: string; insignia?: keyof Insignias; tono?: "teja" | "error" };
export type Insignias = { contadores: number; soporte: number; cobros: number; legal: number };

const GRUPOS: { titulo: string | null; secciones: Seccion[] }[] = [
  { titulo: "Resumen", secciones: [
    { texto: "Panel general", icono: "resumen", href: "/consola" },
    { texto: "Analítica", icono: "meta", href: "/consola/analitica" },
  ] },
  { titulo: "Clientes", secciones: [
    { texto: "Hogares", icono: "casa", href: "/consola/hogares" },
    { texto: "Usuarios", icono: "familia", href: "/consola/usuarios" },
    { texto: "Contadores", icono: "declaracion-renta", href: "/consola/contadores", insignia: "contadores", tono: "teja" },
    { texto: "Soporte", icono: "alertas", href: "/consola/soporte", insignia: "soporte", tono: "error" },
  ] },
  { titulo: "Ingresos", secciones: [
    { texto: "Cobros", icono: "cuentas", href: "/consola/cobros", insignia: "cobros", tono: "error" },
    { texto: "Planes y cupones", icono: "ahorro", href: "/consola/planes" },
    { texto: "Ofertas y enlaces", icono: "entretenimiento", href: "/consola/ofertas" },
  ] },
  { titulo: "Contenido", secciones: [
    { texto: "Correos y campañas", icono: "servicios", href: "/consola/comunicaciones" },
    { texto: "Plantillas de WhatsApp", icono: "conectividad", href: "/consola/whatsapp" },
    { texto: "Academia", icono: "educacion", href: "/consola/academia" },
    { texto: "Legal", icono: "certificados", href: "/consola/legal", insignia: "legal", tono: "teja" },
  ] },
  { titulo: "Configuración", secciones: [
    { texto: "Parámetros DIAN", icono: "deducciones", href: "/consola/parametros" },
    { texto: "Catálogos", icono: "documentos", href: "/consola/catalogos" },
    { texto: "IA y automatizaciones", icono: "egresos", href: "/consola/ia" },
    { texto: "Equipo y permisos", icono: "familia", href: "/consola/equipo" },
    { texto: "Integraciones", icono: "conectividad", href: "/consola/integraciones" },
  ] },
  { titulo: null, secciones: [
    { texto: "Ajustes de la plataforma", icono: "configuracion", href: "/consola/ajustes" },
    { texto: "Privacidad y auditoría", icono: "documentos", href: "/consola/privacidad" },
    { texto: "Estado del sistema", icono: "alertas", href: "/consola/sistema" },
  ] },
];
const SECCIONES = GRUPOS.flatMap((g) => g.secciones);

function Insignia({ n, tono }: { n: number; tono?: "teja" | "error" }) {
  if (!n) return null;
  return (
    <span
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
        tono === "error" ? "bg-error text-white" : "bg-teja text-[#1b130f]",
        "absolute -top-1 -right-1 xl:static xl:ml-auto",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

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
export function NavegacionConsola({ lugar, insignias }: { lugar: Lugar; insignias?: Insignias }) {
  return <BarraConsola lugar={lugar} ruta={usePathname()} insignias={insignias} />;
}

/** Barra lateral (laptop: solo íconos; escritorio: completa) o, en pantallas chicas, fila desplazable arriba. */
export function BarraConsola({ lugar, ruta, insignias }: { lugar: Lugar; ruta: string | null; insignias?: Insignias }) {
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
            <span className="hidden items-center gap-2.5 xl:flex">
              <Logo alto={28} />
              <span className="inline-flex h-[22px] items-center rounded-full bg-seleccion px-2 text-xs font-bold text-tinta">Admin</span>
            </span>
          </Link>
          <nav className="flex flex-col gap-4">
            {GRUPOS.map((g, i) => (
              <div key={g.titulo ?? i} className={cx("flex flex-col", !g.titulo && "mt-2 border-t border-divisor pt-4")}>
                {g.titulo && <p className="mb-1 hidden px-3 text-[11px] font-bold tracking-[0.08em] text-tenue uppercase xl:block">{g.titulo}</p>}
                {g.secciones.map((s) => {
                  const clase = "relative flex h-10 w-10 items-center justify-center gap-3 rounded-lg text-[15px] xl:w-full xl:justify-start xl:px-3";
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
                      {s.insignia && insignias && <Insignia n={insignias[s.insignia]} tono={s.tono} />}
                      <Pendiente />
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>
    </div>
  );
}

function Fila({ ruta }: { ruta: string | null }) {

  return (
      <nav aria-label="Navegación de la consola" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {SECCIONES.map((s) => {
          const esta = activa(ruta, s.href);
          return (
            <Link
              key={s.texto}
              href={s.href}
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
