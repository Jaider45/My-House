import { nombreDe } from "@/lib/usuario";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Cargando, cx } from "@/components/ui";
import { MarcoMarca } from "@/components/marco-marca";
import { obtenerUsuario } from "@/lib/sesion";
import { FormularioHogar, FormularioInvitarPareja, FormularioPagosFijos } from "./formulario";

export const metadata = { title: "Bienvenida" };

const PASOS = [
  { n: 1, texto: "Crea tu hogar", titulo: "Crea tu hogar", ayuda: "Un hogar reúne las cuentas, pagos y metas que comparten." },
  { n: 2, texto: "Pagos fijos", titulo: "Carga tus pagos fijos", ayuda: "Lo que pagan todos los meses. Ajusta el monto y el día; puedes agregar más después." },
  { n: 3, texto: "Invita a tu pareja", titulo: "Invita a tu pareja", ayuda: "Registren los dos y vean las mismas cuentas. Nadie tiene que pasar recibos por WhatsApp." },
];

export default function Onboarding({ searchParams }: PageProps<"/onboarding">) {
  return (
    <MarcoMarca
      titulo="Cuánto cuesta sostener tu casa, en 3 pasos"
      texto="Con tus pagos fijos calculamos el número mínimo del hogar: lo que necesitan cada mes para que nada se atrase."
      puntos={[
        { icono: "egresos", texto: "Registra un gasto en menos de 10 segundos" },
        { icono: "calendario", texto: "Ve qué se paga y qué se vence este mes" },
        { icono: "declaracion-renta", texto: "Sabe a tiempo si te toca declarar renta" },
      ]}
    >
      <Suspense fallback={<Cargando compacto />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </MarcoMarca>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await obtenerUsuario();
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const pedido = Number(sp.paso) || 1;
  // Sin hogar solo existe el paso 1; con hogar, el paso 1 ya está hecho.
  const paso = !count ? 1 : pedido === 1 ? redirect("/") : Math.min(3, pedido);
  const actual = PASOS[paso - 1];
  const nombre = nombreDe(user.user_metadata);

  return (
    <>
      <nav aria-label="Pasos" className="flex items-center gap-2">
        {PASOS.map((p, i) => (
          <span key={p.n} className="contents">
            {i > 0 && <span className="h-0.5 min-w-4 flex-1 bg-pista" />}
            <span className={cx("flex items-center gap-2 text-sm font-semibold", p.n === paso ? "text-tinta" : "text-cuerpo")} aria-current={p.n === paso ? "step" : undefined}>
              <span
                className={cx(
                  "inline-flex size-7 items-center justify-center rounded-full border-2 text-[13px] font-bold",
                  p.n === paso ? "border-monte bg-monte text-arena" : p.n < paso ? "border-ok bg-ok-fondo text-ok-tinta" : "border-control bg-elevada",
                )}
              >
                {p.n}
              </span>
              <span className="hidden sm:inline">{p.texto}</span>
            </span>
          </span>
        ))}
      </nav>
      <div>
        <p className="mb-2 text-xs leading-4 font-bold tracking-[0.12em] uppercase">Paso {paso} de 3</p>
        <h1 className="text-[28px] leading-[34px] font-bold md:text-[32px] md:leading-[38px]">{actual.titulo}</h1>
        <p className="mt-2 text-base text-cuerpo">{actual.ayuda}</p>
      </div>
      {paso === 1 ? <FormularioHogar nombre={nombre} /> : paso === 2 ? <FormularioPagosFijos /> : <FormularioInvitarPareja />}
    </>
  );
}
