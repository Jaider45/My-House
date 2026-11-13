"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icono, Logo, type NombreIcono } from "@/components/marca";
import { cx } from "@/components/ui";

export type Enlace = { href: string; texto: string; icono: NombreIcono; tambien?: string[] };
type Insignia = { texto: string; tono: "error" | "teja" | "nuevo"; aria: string };
type Grupo = { titulo?: string; enlaces: (Enlace & { insignia?: "revisar" | "vencidos" | "nuevo" })[] };

/** Datos de la barra que salen de la base (layout): contadores e identidad del hogar. */
export type DatosNavegacion = {
  revisar: number;
  vencidos: number;
  hogar: string;
  persona: string;
  rol: string;
  puedeEditar: boolean;
  /** Familiar: no edita, pero registra gastos (botón flotante «Registrar»). */
  puedeRegistrar?: boolean;
};

const GRUPOS: Grupo[] = [
  {
    enlaces: [
      { href: "/", texto: "Inicio", icono: "resumen" },
      { href: "/movimientos", texto: "Movimientos", icono: "egresos", tambien: ["/importar"], insignia: "revisar" },
      { href: "/comprobantes", texto: "Asistente", icono: "documentos" },
    ],
  },
  {
    titulo: "Pagos",
    enlaces: [
      { href: "/recurrentes", texto: "Pagos fijos", icono: "calendario", insignia: "vencidos" },
      { href: "/deudas", texto: "Deudas", icono: "deducciones" },
      { href: "/recordatorios", texto: "Recordatorios", icono: "alertas" },
    ],
  },
  {
    titulo: "Planea",
    enlaces: [
      { href: "/presupuesto", texto: "Presupuesto", icono: "casa" },
      { href: "/metas", texto: "Metas de ahorro", icono: "ahorro" },
    ],
  },
  { titulo: "Impuestos", enlaces: [{ href: "/impuestos", texto: "Renta DIAN", icono: "declaracion-renta" }] },
  { titulo: "Aprende", enlaces: [{ href: "/academia", texto: "Academia", icono: "educacion", tambien: ["/guias"], insignia: "nuevo" }] },
];

const ABAJO: Enlace[] = [
  { href: "/cuentas", texto: "Cuentas y tarjetas", icono: "cuentas" },
  { href: "/ajustes", texto: "Hogar y ajustes", icono: "configuracion", tambien: ["/categorias"] },
  { href: "/ayuda", texto: "Ayuda", icono: "certificados" },
];

const INFERIOR: Enlace[] = [
  { href: "/", texto: "Inicio", icono: "resumen" },
  { href: "/movimientos", texto: "Movimientos", icono: "egresos", tambien: ["/importar"] },
  { href: "/presupuesto", texto: "Presupuesto", icono: "casa" },
  { href: "/recurrentes", texto: "Pagos fijos", icono: "calendario" },
];

/**
 * Botón flotante (celular y tablet): crea lo de la sección en la que estás, como en el diseño («Pago fijo» en Pagos
 * fijos, «Deuda» en Deudas…). Fuera de esas secciones registra un movimiento. `null` = sin botón (pantallas que ya
 * tienen su propia acción principal o en las que tapa algo).
 */
function botonFlotante(ruta: string | null, puedeEditar: boolean, puedeRegistrar = puedeEditar): { texto: string; href: string } | null {
  if (!ruta || !puedeRegistrar) return null;
  if (!puedeEditar) return ruta === "/rapido" ? null : { texto: "Registrar", href: "/rapido" };
  const propio: [string, string][] = [
    ["/recurrentes", "Pago fijo"],
    ["/deudas", "Deuda"],
    ["/metas", "Meta"],
    ["/presupuesto", "Presupuesto"],
    ["/recordatorios", "Recordatorio"],
    ["/cuentas", "Cuenta"],
  ];
  const seccion = propio.find(([r]) => ruta === r);
  if (seccion) return { texto: seccion[1], href: `${seccion[0]}?nuevo=1` };
  const sin = ["/rapido", "/comprobantes", "/impuestos", "/ajustes", "/mas", "/academia", "/guias", "/ayuda", "/clientes", "/categorias"];
  if (sin.some((r) => ruta === r || ruta.startsWith(`${r}/`))) return null;
  return { texto: "Registrar", href: "/rapido" };
}

const esActivo = (ruta: string | null, e: Enlace) =>
  ruta !== null && [e.href, ...(e.tambien ?? [])].some((h) => (h === "/" ? ruta === "/" : ruta === h || ruta.startsWith(`${h}/`)));

const iniciales = (nombre: string) =>
  nombre
    .replace(/^hogar\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "MH";

/**
 * Barra fina arriba mientras carga la pantalla elegida. Las pantallas no tienen esqueleto propio: React deja la
 * anterior hasta que la nueva llega. Aparece tras 150 ms para no parpadear en las navegaciones rápidas.
 */
function Pendiente() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-teja transition-opacity",
        pending ? "animate-pulse opacity-100 delay-150" : "opacity-0",
      )}
    />
  );
}

const claseInsignia: Record<Insignia["tono"], string> = {
  error: "inline-flex bg-error text-white",
  teja: "inline-flex bg-teja text-[#1b130f]",
  nuevo: "hidden bg-ok-fondo text-ok-tinta xl:inline-flex",
};

function insigniaDe(tipo: Grupo["enlaces"][number]["insignia"], datos?: DatosNavegacion): Insignia | null {
  if (tipo === "nuevo") return { texto: "Nuevo", tono: "nuevo", aria: "Nuevo" };
  if (!datos) return null;
  if (tipo === "revisar" && datos.revisar) return { texto: String(datos.revisar), tono: "teja", aria: `${datos.revisar} por revisar` };
  if (tipo === "vencidos" && datos.vencidos)
    return { texto: String(datos.vencidos), tono: "error", aria: `${datos.vencidos} ${datos.vencidos === 1 ? "vencido" : "vencidos"}` };
  return null;
}

function ItemLateral({ e, ruta, insignia }: { e: Enlace; ruta: string | null; insignia?: Insignia | null }) {
  const activo = esActivo(ruta, e);
  return (
    <Link
      href={e.href}
      title={e.texto}
      aria-current={activo ? "page" : undefined}
      className={cx(
        "relative flex h-10 w-11 items-center justify-center gap-3 rounded-lg text-[15px] xl:w-full xl:justify-start xl:px-3",
        activo ? "bg-seleccion font-semibold text-tinta" : "text-cuerpo hover:text-tinta",
      )}
    >
      <Icono nombre={e.icono} tamano={20} relleno={activo} />
      <span className="sr-only xl:not-sr-only xl:flex-1 xl:truncate">{e.texto}</span>
      {insignia && (
        <span
          aria-label={insignia.aria}
          className={cx(
            "pointer-events-none absolute -top-1 -right-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-bold",
            "xl:static xl:h-[22px] xl:min-w-[22px] xl:px-[7px] xl:text-xs",
            claseInsignia[insignia.tono],
          )}
        >
          {insignia.texto}
        </span>
      )}
      <Pendiente />
    </Link>
  );
}

/** Navegación con el ítem activo según la ruta (usePathname: va detrás de <Suspense>). */
export function Navegacion({ extras, datos }: { extras?: Enlace[]; datos?: DatosNavegacion }) {
  return <BarraNavegacion ruta={usePathname()} extras={extras} datos={datos} />;
}

/**
 * Barra lateral agrupada (laptop: solo íconos; escritorio: completa) y, en celular y tablet, barra inferior con el
 * botón flotante de crear. Diseño «App» del lienzo: Pagos, Planea, Impuestos y Aprende con rótulo de grupo.
 */
export function BarraNavegacion({ ruta, extras, datos }: { ruta: string | null; extras?: Enlace[]; datos?: DatosNavegacion }) {
  const grupos: Grupo[] = extras?.length ? [{ enlaces: [GRUPOS[0].enlaces[0], ...extras, ...GRUPOS[0].enlaces.slice(1)] }, ...GRUPOS.slice(1)] : GRUPOS;
  const flotante = botonFlotante(ruta, datos?.puedeEditar ?? false, datos?.puedeRegistrar ?? datos?.puedeEditar ?? false);
  const enMas = ruta !== null && !INFERIOR.some((e) => esActivo(ruta, e));
  return (
    <>
      <aside
        aria-label="Navegación principal"
        className="sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col items-center gap-4 overflow-y-auto border-r border-borde bg-elevada px-3 py-5 lg:flex xl:w-[272px] xl:items-stretch xl:px-4"
      >
        <Link href="/" className="flex min-h-10 items-center xl:px-1" aria-label="Inicio">
          <span className="xl:hidden">
            <Logo forma="isotipo" alto={32} />
          </span>
          <span className="hidden xl:block">
            <Logo alto={32} />
          </span>
        </Link>
        {grupos.map((g, i) => (
          <nav key={g.titulo ?? i} aria-label={g.titulo} className="flex flex-col items-center gap-0.5 xl:items-stretch">
            {g.titulo && <p className="mb-1.5 ml-3 hidden text-xs font-bold tracking-[0.1em] text-cuerpo uppercase xl:block">{g.titulo}</p>}
            {g.enlaces.map((e) => (
              <ItemLateral key={e.href} e={e} ruta={ruta} insignia={insigniaDe(e.insignia, datos)} />
            ))}
          </nav>
        ))}
        <span className="flex-1" />
        <nav aria-label="Cuenta y ayuda" className="flex flex-col items-center gap-0.5 xl:items-stretch">
          {ABAJO.map((e) => (
            <ItemLateral key={e.href} e={e} ruta={ruta} />
          ))}
        </nav>
        {datos && (
          <Link
            href="/ajustes/hogar"
            title={datos.hogar}
            className="flex items-center gap-2.5 rounded-xl text-sm xl:border xl:border-borde xl:p-2.5 xl:hover:bg-mosaico"
          >
            <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-monte text-[13px] font-bold text-arena">
              {iniciales(datos.hogar)}
            </span>
            <span className="hidden min-w-0 flex-1 xl:block">
              <b className="block truncate">{datos.hogar}</b>
              <span className="block truncate text-[13px] text-tenue">
                {datos.persona} · {datos.rol}
              </span>
            </span>
          </Link>
        )}
      </aside>

      {flotante && (
        <Link
          href={flotante.href}
          data-guia="boton-flotante"
          className="fixed right-4 bottom-[calc(90px+env(safe-area-inset-bottom))] z-30 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-teja pr-5 pl-4 text-base font-bold text-[#1b130f] shadow-[0_10px_24px_rgba(224,100,60,0.35)] lg:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          {flotante.texto}
        </Link>
      )}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-borde bg-elevada px-1 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden"
      >
        {INFERIOR.map((e) => {
          const activo = esActivo(ruta, e);
          return (
            <Link
              key={e.href}
              href={e.href}
              aria-current={activo ? "page" : undefined}
              className={cx(
                "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-xs leading-4",
                activo ? "bg-seleccion font-bold text-tinta" : "text-cuerpo",
              )}
            >
              <Icono nombre={e.icono} tamano={22} relleno={activo} />
              {e.texto}
              <Pendiente />
            </Link>
          );
        })}
        <Link
          href="/mas"
          aria-current={enMas ? "page" : undefined}
          className={cx("flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-xs leading-4", enMas ? "bg-seleccion font-bold text-tinta" : "text-cuerpo")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
            <circle cx="19" cy="12" r="1.2" />
          </svg>
          Más
          <Pendiente />
        </Link>
      </nav>
    </>
  );
}
