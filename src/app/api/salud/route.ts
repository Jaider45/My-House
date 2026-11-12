import { connection, NextResponse } from "next/server";
import { chequear, COMPONENTES } from "@/lib/salud";

/** Resumen de todos los componentes (para mirar a mano). 503 si alguno falla. Los monitores usan /api/salud/<c>. */
export async function GET() {
  await connection();
  const resultados = await Promise.all(COMPONENTES.map(async (c) => [c, (await chequear(c)).ok ? "operativo" : "falla"] as const));
  const todos = resultados.every(([, e]) => e === "operativo");
  return NextResponse.json(Object.fromEntries(resultados), { status: todos ? 200 : 503, headers: { "cache-control": "no-store" } });
}
