import Link from "next/link";
import { Boton, Chip, FilaLista, Tarjeta, Titulo } from "@/components/ui";
import type { NombreIcono } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { cerrarSesion } from "@/app/(auth)/acciones";
import { PestanasConfiguracion } from "./pestanas";

export const metadata = { title: "Configuración" };

const SECCIONES: { href: string; titulo: string; texto: string; icono: NombreIcono }[] = [
  { href: "/comprobantes", titulo: "Comprobantes", texto: "Fotos y PDF que se registran solos", icono: "documentos" },
  { href: "/deudas", titulo: "Deudas", texto: "Cuánto deben y cuándo terminan", icono: "deducciones" },
  { href: "/metas", titulo: "Metas de ahorro", texto: "Para qué ahorra la casa", icono: "ahorro" },
  { href: "/impuestos", titulo: "Renta DIAN", texto: "Topes para declarar y soportes", icono: "declaracion-renta" },
  { href: "/cuentas", titulo: "Cuentas y tarjetas", texto: "Bancos, billeteras, tarjetas y efectivo", icono: "cuentas" },
  { href: "/recordatorios", titulo: "Recordatorios", texto: "Fechas de pago para que nada se venza", icono: "alertas" },
  { href: "/importar", titulo: "Importar extracto", texto: "PDF o CSV del banco, sin duplicados", icono: "egresos" },
  { href: "/ajustes/hogar", titulo: "Hogar", texto: "Nombre y cuota de imprevistos", icono: "casa" },
  { href: "/ajustes/miembros", titulo: "Miembros", texto: "Pareja, hijos, contador e invitaciones", icono: "familia" },
  { href: "/categorias", titulo: "Categorías", texto: "Árbol de gastos e ingresos", icono: "resumen" },
  { href: "/ajustes/seguridad", titulo: "Seguridad", texto: "Verificación en dos pasos", icono: "certificados" },
];

const ROLES = { admin: "Administrador", editor: "Editor", contador: "Contador · solo lectura" } as const;

export default function Ajustes() {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes" />
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-4 md:gap-5">
          <Encabezado />
          <form action={cerrarSesion}>
            <Boton type="submit" variante="secundario" className="w-full">
              Cerrar sesión
            </Boton>
          </form>
        </div>
        <Tarjeta className="lg:col-span-2" titulo="Todo My House" subtitulo="Las secciones del hogar y su configuración">
          <div className="grid md:grid-cols-2 md:gap-x-6">
            {SECCIONES.map((s) => (
              <Link key={s.href} href={s.href} className="block rounded-lg hover:bg-mosaico/60">
                <FilaLista icono={s.icono} titulo={s.titulo} detalle={s.texto} valor={<span aria-hidden className="text-tenue">›</span>} />
              </Link>
            ))}
          </div>
        </Tarjeta>
      </div>
    </>
  );
}

async function Encabezado() {
  const ctx = await obtenerContexto();
  const iniciales = ctx.miembro.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <Tarjeta titulo={ctx.hogar.nombre} subtitulo="Todos ven el mismo hogar; cada rol decide qué puede cambiar">
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-monte font-bold text-arena">{iniciales}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-[15px]">{ctx.miembro.nombre}</b>
          <span className="truncate text-[13px] text-tenue">{ctx.email}</span>
        </span>
        <Chip tono="info">{ROLES[ctx.miembro.rol as keyof typeof ROLES] ?? ctx.miembro.rol}</Chip>
      </div>
    </Tarjeta>
  );
}
