import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Cargando, Tarjeta } from "@/components/ui";
import { obtenerUsuario } from "@/lib/sesion";
import { FormularioHogar } from "./formulario";

export const metadata = { title: "Crear hogar" };

export default function Onboarding() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-2xl font-bold">Bienvenido a My House</p>
        <p className="text-sm text-zinc-500">
          Cree su hogar. Después podrá invitar a su pareja desde Ajustes. Si alguien ya lo invitó, abra el enlace
          que le compartió.
        </p>
      </div>
      <Tarjeta titulo="Su hogar">
        <Suspense fallback={<Cargando />}>
          <Contenido />
        </Suspense>
      </Tarjeta>
    </main>
  );
}

async function Contenido() {
  const { supabase, user } = await obtenerUsuario();
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (count) redirect("/");
  const nombre = (user.user_metadata?.nombre as string | undefined) ?? "";
  return <FormularioHogar nombre={nombre} />;
}
