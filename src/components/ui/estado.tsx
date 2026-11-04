import { Aviso } from ".";
import type { Estado } from "@/lib/acciones";

export function MensajeEstado({ estado }: { estado: Estado }) {
  if (estado?.error) return <Aviso>{estado.error}</Aviso>;
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return null;
}
