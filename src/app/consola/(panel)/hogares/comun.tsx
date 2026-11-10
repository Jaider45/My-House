import { Chip, type Tono } from "@/components/ui";

export type FilaHogar = {
  id: string;
  nombre: string;
  admin_nombre: string | null;
  plan: string;
  plan_efectivo: string;
  miembros: number;
  movimientos_30d: number;
  mrr: number;
  estado: string;
  en_prueba: boolean;
  ultimo_uso: string | null;
  created_at: string;
};

export function ChipPlan({ plan, enPrueba }: { plan: string; enPrueba?: boolean }) {
  if (enPrueba) return <Chip tono="info">Prueba Familia</Chip>;
  const tono: Tono = plan === "gratis" ? "neutro" : plan === "contador" ? "alerta" : "info";
  return (
    <Chip tono={tono} plano>
      {etiquetaPlan(plan)}
    </Chip>
  );
}

/** «familia» → «Familia» (los códigos de plan son minúsculas). */
export const etiquetaPlan = (codigo: string) => codigo.charAt(0).toUpperCase() + codigo.slice(1);
