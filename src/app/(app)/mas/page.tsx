import Link from "next/link";
import { nombreRol } from "@/lib/hogar/constantes";
import { Titulo } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { cerrarSesion } from "@/app/(auth)/acciones";

export const metadata = { title: "Más" };

const PAGOS_Y_PLAN: [string, NombreIcono, string, string][] = [
  ["/presupuesto", "casa", "Presupuesto", "Cuánto puedes gastar"],
  ["/metas", "ahorro", "Metas de ahorro", "Para qué ahorran"],
  ["/deudas", "deducciones", "Deudas", "Cuánto deben y cuándo terminan"],
  ["/recordatorios", "alertas", "Recordatorios", "Avisos de fechas de pago"],
  ["/impuestos", "declaracion-renta", "Renta DIAN", "Quién declara y qué falta"],
];

const HERRAMIENTAS: [string, NombreIcono, string, string][] = [
  ["/academia", "educacion", "Academia", "Cursos y guías paso a paso"],
  ["/comprobantes", "documentos", "Asistente", "Sube comprobantes"],
  ["/cuentas", "cuentas", "Cuentas y tarjetas", "Bancos, Nequi, efectivo"],
  ["/ajustes", "configuracion", "Hogar y ajustes", "Miembros, categorías, plan"],
];


/** Menú «Más» del celular (diseño «Menú Más»): lo que no cabe en la barra inferior. */
export default async function Mas() {
  const ctx = await obtenerContexto();
  const iniciales = ctx.hogar.nombre
    .replace(/^hogar\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const rejilla = (lista: typeof PAGOS_Y_PLAN) => (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
      {lista.map(([href, icono, titulo, texto]) => (
        <Link key={href} href={href} className="flex flex-col gap-2 rounded-2xl border border-borde bg-elevada p-4 text-[15px] font-bold hover:bg-arena">
          <span className="inline-flex size-10 items-center justify-center rounded-lg bg-mosaico">
            <Icono nombre={icono} tamano={22} />
          </span>
          {titulo}
          <small className="text-[13px] leading-[18px] font-normal text-cuerpo">{texto}</small>
        </Link>
      ))}
    </div>
  );
  return (
    <>
      <Titulo subtitulo="Todo lo demás de My House">Más</Titulo>
      <div className="flex flex-col gap-4">
        <Link href="/ajustes" className="flex items-center gap-2.5 rounded-xl border border-borde bg-elevada p-2.5 text-sm">
          <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-monte text-[13px] font-bold text-arena">{iniciales || "MH"}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{ctx.hogar.nombre}</b>
            <span className="text-[13px] text-tenue">
              {ctx.miembro.nombre.split(/\s+/)[0]} · {nombreRol(ctx.miembro.rol)}
            </span>
          </span>
          <span className="px-3 text-sm font-semibold">Ver</span>
        </Link>
        <p className="-mb-1 text-xs leading-4 font-bold tracking-[0.12em] uppercase">Pagos y plan</p>
        {rejilla(PAGOS_Y_PLAN)}
        <p className="-mb-1 text-xs leading-4 font-bold tracking-[0.12em] uppercase">Más herramientas</p>
        {rejilla(HERRAMIENTAS)}
        <section className="flex flex-col rounded-2xl border border-borde bg-elevada px-4 py-2 md:px-6">
          <Link href="/ayuda" className="flex min-h-12 items-center justify-between border-b border-divisor font-semibold">
            Ayuda y soporte
            <span className="text-[13px] font-normal text-tenue">Escríbele al equipo</span>
          </Link>
          <Link href="/ayuda#privacidad" className="flex min-h-12 items-center border-b border-divisor font-semibold">
            Privacidad y datos
          </Link>
          <form action={cerrarSesion}>
            <button type="submit" className="flex min-h-12 w-full items-center font-semibold text-error-tinta">
              Cerrar sesión
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
