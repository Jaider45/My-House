import { Tarjeta } from "@/components/ui";
import { VerificarMfa } from "./verificar";

export const metadata = { title: "Verificación en dos pasos" };

export default function Mfa() {
  return (
    <Tarjeta titulo="Verificación en dos pasos">
      <VerificarMfa />
    </Tarjeta>
  );
}
