import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Cargando, Tarjeta } from "@/components/ui";
import { MarcoMarca } from "@/components/marco-marca";
import { obtenerUsuario } from "@/lib/sesion";
import { FormularioHogar } from "./formulario";

export const metadata = { title: "Crear hogar" };

export default function Onboarding() {
  return (
    <MarcoMarca>
      <div>
        <h1 className="text-[28px] leading-[34px] font-bold">Bienvenido a My House</h1>
        <p className="mt-1 text-base text-cuerpo">
          Cree su hogar. Después podrá invitar a su pareja desde Configuración. Si alguien ya lo invitó, abra el
          enlace que le compartió.
        </p>
      </div>
      <Tarjeta titulo="Su hogar">
        <Suspense fallback={<Cargando compacto />}>
          <Contenido />
        </Suspense>
      </Tarjeta>
    </MarcoMarca>
  );
}

async function Contenido() {
  const { supabase, user } = await obtenerUsuario();
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (count) redirect("/");
  const nombre = (user.user_metadata?.nombre as string | undefined) ?? "";
  return <FormularioHogar nombre={nombre} />;
}
