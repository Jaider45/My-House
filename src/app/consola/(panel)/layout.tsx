import { Suspense } from "react";
import { Boton, Cargando } from "@/components/ui";
import { obtenerStaff } from "@/lib/consola/sesion";
import { salirConsola } from "../(acceso)/ingresar/acciones";
import { BarraConsola, NavegacionConsola, type Insignias } from "./barra";

const ENTORNO = process.env.VERCEL_ENV === "production" ? "Producción" : process.env.VERCEL_ENV === "preview" ? "Pruebas" : "Local";

/** Franja superior del diseño: entorno a la vista (no confundir producción con pruebas) y quién está adentro. */
function Franja({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-3.5 bg-monte px-4 py-3 text-sm text-arena md:px-6 lg:px-8 xl:px-10">
      <b className="font-bold">Consola de administración</b>
      <span className="inline-flex h-6 items-center rounded-full bg-teja px-2.5 text-xs font-bold tracking-[0.04em] text-[#1b130f] uppercase">{ENTORNO}</span>
      <span className="flex-1" />
      <Buscador />
      {children}
    </div>
  );
}

/** Buscador de la franja: hogar, usuario, correo o referencia de un cobro (`/consola/buscar`). */
function Buscador() {
  return (
    <form action="/consola/buscar" role="search" className="order-last w-full md:order-none md:w-auto md:max-w-[360px] md:flex-1">
      <label className="flex h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-arena focus-within:bg-white/15">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Buscar en la consola</span>
        <input
          name="q"
          type="search"
          minLength={2}
          placeholder="Buscar hogar, usuario, correo o cobro"
          className="min-w-0 flex-1 bg-transparent text-sm text-arena outline-none placeholder:text-arena/70"
        />
      </label>
    </form>
  );
}

/** Lo que espera a alguien del equipo (tickets urgentes, pagos en mora, firmas sin verificar, legal listo). */
async function NavegacionConInsignias({ lugar }: { lugar: "lateral" | "fila" }) {
  const staff = await obtenerStaff();
  const { data } = await staff.supabase.rpc("consola_insignias");
  return <NavegacionConsola lugar={lugar} insignias={(data ?? undefined) as Insignias | undefined} />;
}

async function QuienEsta() {
  const staff = await obtenerStaff();
  const iniciales = staff.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <>
      <span className="flex items-center gap-2">
        <span aria-hidden className="inline-flex size-[30px] items-center justify-center rounded-full bg-arena text-xs font-bold text-monte">
          {iniciales}
        </span>
        <span>
          {staff.nombre} · {staff.rolNombre}
        </span>
      </span>
      <form action={salirConsola}>
        <Boton type="submit" variante="fantasma" className="h-8 px-3 text-sm text-arena! hover:bg-white/10!">
          Salir
        </Boton>
      </form>
    </>
  );
}

/**
 * Pantallas de la consola. Como en la app, las páginas no llevan <Suspense> propio: el de `main` cubre la carga
 * directa y al navegar React deja la pantalla anterior hasta que llega la nueva.
 */
export default function LayoutPanelConsola({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1">
      <Suspense fallback={<BarraConsola lugar="lateral" ruta={null} />}>
        <NavegacionConInsignias lugar="lateral" />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col lg:pt-4 lg:pr-4">
        <div className="overflow-hidden lg:rounded-2xl">
          <Franja>
            <Suspense>
              <QuienEsta />
            </Suspense>
          </Franja>
        </div>
        <main className="min-w-0 flex-1 px-4 pt-4 pb-16 md:px-6 md:pt-5 lg:px-4 lg:pt-6 xl:px-6">
          <div className="mb-4 lg:hidden">
            <Suspense fallback={<BarraConsola lugar="fila" ruta={null} />}>
              <NavegacionConsola lugar="fila" />
            </Suspense>
          </div>
          <Suspense fallback={<Cargando />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
