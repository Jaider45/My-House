"use server";

import { revalidatePath } from "next/cache";
import type { Estado } from "@/lib/acciones";
import { aceptarVigentes } from "@/lib/legal/servidor";

export async function aceptarDocumentos(): Promise<Estado> {
  const error = await aceptarVigentes();
  if (error) return { error };
  revalidatePath("/", "layout");
  return { ok: "Gracias. Ya puedes seguir." };
}
