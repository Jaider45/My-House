import { redirect } from "next/navigation";

/** «Hogar» ahora es la primera pestaña de Configuración. */
export default function Hogar() {
  redirect("/ajustes");
}
