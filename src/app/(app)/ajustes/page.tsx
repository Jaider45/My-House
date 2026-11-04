import Link from "next/link";
import { Suspense } from "react";
import { Boton, Cargando, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cerrarSesion } from "@/app/(auth)/acciones";

export const metadata = { title: "Más" };

const SECCIONES = [
  { href: "/cuentas", titulo: "Cuentas", texto: "Bancos, efectivo y tarjetas" },
  { href: "/categorias", titulo: "Categorías", texto: "Árbol de gastos e ingresos" },
  { href: "/recurrentes", titulo: "Gastos recurrentes", texto: "Arriendo, colegio, servicios…" },
  { href: "/importar", titulo: "Importar extracto", texto: "CSV del banco" },
  { href: "/ajustes/miembros", titulo: "Miembros", texto: "Pareja, hijos e invitaciones" },
  { href: "/ajustes/hogar", titulo: "Hogar", texto: "Nombre y cuota de imprevistos" },
  { href: "/ajustes/seguridad", titulo: "Seguridad", texto: "Verificación en dos pasos" },
];

export default function Ajustes() {
  return (
    <>
      <Titulo>Más</Titulo>
      <Suspense fallback={<Cargando />}>
        <Encabezado />
      </Suspense>
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
        {SECCIONES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <span>
                <span className="block font-medium">{s.titulo}</span>
                <span className="block text-sm text-zinc-500">{s.texto}</span>
              </span>
              <span aria-hidden className="text-zinc-400">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={cerrarSesion} className="mt-6">
        <Boton type="submit" variante="secundario" className="w-full">
          Cerrar sesión
        </Boton>
      </form>
    </>
  );
}

async function Encabezado() {
  const ctx = await obtenerContexto();
  return (
    <Tarjeta className="mb-4">
      <p className="font-semibold">{ctx.hogar.nombre}</p>
      <p className="text-sm text-zinc-500">
        {ctx.miembro.nombre} · {ctx.email} · {ctx.miembro.rol}
      </p>
    </Tarjeta>
  );
}
