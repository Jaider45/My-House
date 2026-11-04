import { Suspense } from "react";
import { Boton, Cargando, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP } from "@/lib/dinero";
import { archivarCuenta } from "./acciones";
import { BotonEliminarCuenta, FormularioCuenta } from "./formulario";

export const metadata = { title: "Cuentas" };

const TIPOS = { banco: "Banco", efectivo: "Efectivo", tarjeta: "Tarjeta de crédito" } as const;

export default function Cuentas() {
  return (
    <>
      <Titulo>Cuentas</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  const [{ data: cuentas }, { data: saldos }, { data: miembros }] = await Promise.all([
    ctx.supabase.from("accounts").select("id, tipo, nombre, saldo_inicial, titular_member_id, archivada").order("archivada").order("created_at"),
    ctx.supabase.from("account_balances").select("account_id, saldo"),
    ctx.supabase.from("members").select("id, nombre").eq("es_dependiente", false).order("created_at"),
  ]);
  const saldo = new Map(saldos?.map((s) => [s.account_id, s.saldo ?? 0]));
  const titular = new Map(miembros?.map((m) => [m.id, m.nombre]));
  const titulares = miembros ?? [];
  const activas = cuentas?.filter((c) => !c.archivada) ?? [];
  const total = activas.reduce((s, c) => s + (saldo.get(c.id) ?? 0), 0);

  return (
    <div className="space-y-4">
      {activas.length > 0 && (
        <Tarjeta>
          <p className="text-sm text-zinc-500">Saldo total (cuentas activas)</p>
          <p className={`text-2xl font-bold ${total < 0 ? "text-red-600" : ""}`}>{formatearCOP(total)}</p>
        </Tarjeta>
      )}

      <Tarjeta titulo="Sus cuentas">
        {cuentas?.length ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {cuentas.map((c) => {
              const s = saldo.get(c.id) ?? 0;
              return (
                <li key={c.id} className={c.archivada ? "opacity-50" : ""}>
                  <details className="group py-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                      <span>
                        <span className="block font-medium">
                          {c.nombre}
                          {c.archivada && <span className="text-xs text-zinc-500"> · archivada</span>}
                        </span>
                        <span className="text-sm text-zinc-500">
                          {TIPOS[c.tipo]}
                          {c.titular_member_id && ` · ${titular.get(c.titular_member_id) ?? ""}`}
                        </span>
                      </span>
                      <span className={`font-semibold tabular-nums ${s < 0 ? "text-red-600" : ""}`}>{formatearCOP(s)}</span>
                    </summary>
                    {ctx.puedeEditar && (
                      <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
                        <FormularioCuenta cuenta={c} titulares={titulares} />
                        <form action={archivarCuenta}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="archivar" value={c.archivada ? "0" : "1"} />
                          <Boton type="submit" variante="secundario" className="w-full">
                            {c.archivada ? "Reactivar" : "Archivar"}
                          </Boton>
                        </form>
                        <BotonEliminarCuenta id={c.id} />
                      </div>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <Vacio>Aún no tiene cuentas. Cree la primera para empezar a registrar.</Vacio>
        )}
      </Tarjeta>

      {ctx.puedeEditar && (
        <Tarjeta titulo="Nueva cuenta">
          <FormularioCuenta titulares={titulares} />
        </Tarjeta>
      )}
    </div>
  );
}
