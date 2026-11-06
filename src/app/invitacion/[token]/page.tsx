import { nombreDe } from "@/lib/usuario";
import { Suspense } from "react";
import { Aviso, Cargando, EnlaceBoton, Tarjeta } from "@/components/ui";
import { MarcoMarca } from "@/components/marco-marca";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioAceptar } from "./formulario";

export const metadata = { title: "Invitación" };

const ROLES = { admin: "administrador", editor: "editor", contador: "contador (solo lectura)" } as const;

export default function Invitacion({ params }: PageProps<"/invitacion/[token]">) {
  return (
    <MarcoMarca>
      <Tarjeta titulo="Invitación a un hogar">
        <Suspense fallback={<Cargando compacto />}>
          <Contenido params={params} />
        </Suspense>
      </Tarjeta>
    </MarcoMarca>
  );
}

async function Contenido({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await crearClienteServidor();
  const [{ data: filas }, { data: sesion }] = await Promise.all([
    supabase.rpc("ver_invitacion", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const inv = filas?.[0];

  if (!inv) return <Aviso>Esta invitación no existe. Pide un enlace nuevo.</Aviso>;
  if (!inv.vigente) return <Aviso>Esta invitación ya se usó o venció. Pide un enlace nuevo.</Aviso>;

  const encabezado = (
    <p className="mb-4 text-sm">
      Lo invitaron a <strong>{inv.hogar}</strong> como <strong>{ROLES[inv.rol]}</strong>. La invitación es para{" "}
      <strong>{inv.email}</strong>.
    </p>
  );
  const siguiente = encodeURIComponent(`/invitacion/${token}`);
  const email = encodeURIComponent(inv.email);

  const user = sesion.user;
  if (!user) {
    return (
      <div className="space-y-3">
        {encabezado}
        <EnlaceBoton href={`/registro?siguiente=${siguiente}&email=${email}`} className="w-full">
          Crear cuenta
        </EnlaceBoton>
        <EnlaceBoton href={`/ingresar?siguiente=${siguiente}&email=${email}`} variante="secundario" className="w-full">
          Ya tengo cuenta
        </EnlaceBoton>
      </div>
    );
  }

  if (user.email?.toLowerCase() !== inv.email.toLowerCase()) {
    return (
      <div className="space-y-3">
        {encabezado}
        <Aviso>
          Ingresaste como {user.email}. Cierra sesión e ingresa con {inv.email} para aceptar.
        </Aviso>
      </div>
    );
  }

  return (
    <div>
      {encabezado}
      <FormularioAceptar token={token} nombre={nombreDe(user.user_metadata)} />
    </div>
  );
}
