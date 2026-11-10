"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { cx } from "@/components/ui";
import { LIMITES, type Plan } from "@/lib/planes";
import { guardarCupon, guardarPlan, guardarReglas } from "./acciones";

const control = "h-9 rounded-lg border border-control bg-elevada px-2 text-right text-[15px] disabled:bg-pagina";

/** Tarjeta editable de un plan (diseño AdminPlanes): precios, límites y publicado. */
export function EditorPlan({ plan, puede }: { plan: Plan; puede: boolean }) {
  const [estado, enviar] = useActionState(guardarPlan, null);
  const limites = LIMITES.filter((l) => l.para === "ambos" || l.para === plan.para);
  return (
    <form
      action={enviar}
      className={cx("flex flex-col gap-3.5 rounded-2xl border bg-elevada p-4 md:p-6", plan.codigo === "familia" ? "border-monte shadow-[inset_0_0_0_1px_var(--color-monte)]" : "border-borde")}
    >
      <input type="hidden" name="codigo" value={plan.codigo} />
      <input type="hidden" name="limites_previos" value={JSON.stringify(plan.limites)} />
      <div className="flex items-center justify-between gap-3">
        <input name="nombre" defaultValue={plan.nombre} disabled={!puede} aria-label="Nombre del plan" className="min-w-0 rounded-lg border border-transparent bg-transparent text-xl font-bold hover:border-control disabled:hover:border-transparent" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publicado" defaultChecked={plan.publicado} disabled={!puede || plan.codigo === "gratis"} className="size-4 accent-monte" />
          Publicado
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["mensual", "anual"] as const).map((p) => (
          <label key={p} className="flex flex-col gap-1.5 text-[13px] font-semibold text-cuerpo">
            {p === "mensual" ? "Mensual" : "Anual"} ($)
            <input name={p} inputMode="numeric" defaultValue={p === "mensual" ? plan.precio_mensual : plan.precio_anual} disabled={!puede || plan.codigo === "gratis"} className={control} />
          </label>
        ))}
      </div>
      <div className="flex flex-col">
        {limites.map((l) => (
          <label key={l.clave} className="flex min-h-10 items-center justify-between gap-3 border-b border-divisor text-sm last:border-0">
            <span className="text-cuerpo">
              {l.texto}
              {l.unidad ? ` (${l.unidad})` : ""}
            </span>
            {l.tipo === "si_no" ? (
              <>
                <input type="hidden" name={`lim_${l.clave}_presente`} value="1" />
                <input type="checkbox" name={`lim_${l.clave}`} defaultChecked={plan.limites[l.clave] === true} disabled={!puede} className="size-4 accent-monte" />
              </>
            ) : (
              <input
                name={`lim_${l.clave}`}
                inputMode="numeric"
                placeholder="Sin límite"
                defaultValue={plan.limites[l.clave] == null ? "" : String(plan.limites[l.clave])}
                disabled={!puede}
                className={cx(control, "w-28")}
              />
            )}
          </label>
        ))}
      </div>
      <MensajeEstado estado={estado} />
      {puede && (
        <BotonEnviar variante="secundario" pendiente="Publicando…">
          Publicar cambios
        </BotonEnviar>
      )}
    </form>
  );
}

export function EditorReglas({ reglas, puede }: { reglas: { prueba_dias: number; descuento_anual_visible: boolean; iva_incluido: boolean }; puede: boolean }) {
  const [estado, enviar] = useActionState(guardarReglas, null);
  const fila = "flex items-center gap-3 border-b border-divisor py-3 text-sm last:border-0";
  return (
    <form action={enviar} className="flex flex-col">
      <label className={fila}>
        <span className="flex-1">
          <b>Prueba de Familia</b>
          <br />
          <span className="text-cuerpo">Días sin tarjeta; al terminar pasa a Gratis (0 = sin prueba)</span>
        </span>
        <input name="prueba_dias" inputMode="numeric" defaultValue={reglas.prueba_dias} disabled={!puede} className={cx(control, "w-16")} />
      </label>
      <label className={fila}>
        <span className="flex-1">
          <b>Descuento anual visible</b>
          <br />
          <span className="text-cuerpo">Muestra «2 meses gratis» en el plan anual</span>
        </span>
        <input type="checkbox" name="descuento_anual_visible" defaultChecked={reglas.descuento_anual_visible} disabled={!puede} className="size-4 accent-monte" />
      </label>
      <label className={fila}>
        <span className="flex-1">
          <b>Precios con IVA incluido</b>
          <br />
          <span className="text-cuerpo">Se discrimina en la factura electrónica</span>
        </span>
        <input type="checkbox" name="iva_incluido" defaultChecked={reglas.iva_incluido} disabled={!puede} className="size-4 accent-monte" />
      </label>
      <div className={fila}>
        <span className="flex-1">
          <b>Moneda</b>
          <br />
          <span className="text-cuerpo">Pesos colombianos (Wompi)</span>
        </span>
        <span className="chip chip-plano">COP</span>
      </div>
      <MensajeEstado estado={estado} />
      {puede && (
        <BotonEnviar variante="secundario" className="mt-3" pendiente="Guardando…">
          Guardar reglas
        </BotonEnviar>
      )}
    </form>
  );
}

export type Cupon = {
  codigo: string;
  descripcion: string;
  tipo: "porcentaje" | "meses_gratis";
  valor: number;
  periodos: number | null;
  planes: string[];
  periodo: "mensual" | "anual" | null;
  usos_max: number | null;
  usos: number;
  desde: string;
  hasta: string | null;
  activo: boolean;
};

/** Crear un cupón nuevo o editar uno (si llega `cupon`). */
export function FormularioCupon({ cupon, planes }: { cupon?: Cupon; planes: { codigo: string; nombre: string }[] }) {
  const [estado, enviar] = useActionState(guardarCupon, null);
  const campo = "h-10 rounded-lg border border-control bg-elevada px-3 text-[15px]";
  const etiqueta = "flex flex-col gap-1.5 text-[13px] font-semibold text-cuerpo";
  return (
    <form action={enviar} key={cupon?.codigo ?? "nuevo"} className="flex flex-col gap-3">
      <label className={etiqueta}>
        Código
        <input name="codigo" required defaultValue={cupon?.codigo} readOnly={Boolean(cupon)} className={cx(campo, "uppercase")} />
      </label>
      <label className={etiqueta}>
        Descripción
        <input name="descripcion" defaultValue={cupon?.descripcion} placeholder="50 % por 3 meses" className={campo} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Tipo
          <select name="tipo" defaultValue={cupon?.tipo ?? "porcentaje"} className={campo}>
            <option value="porcentaje">Porcentaje</option>
            <option value="meses_gratis">Meses gratis</option>
          </select>
        </label>
        <label className={etiqueta}>
          Valor (% o meses)
          <input name="valor" inputMode="numeric" required defaultValue={cupon?.valor ?? 20} className={campo} />
        </label>
        <label className={etiqueta}>
          Cobros con descuento
          <input name="periodos" inputMode="numeric" defaultValue={cupon?.periodos ?? ""} placeholder="Siempre" className={campo} />
        </label>
        <label className={etiqueta}>
          Pago
          <select name="periodo" defaultValue={cupon?.periodo ?? ""} className={campo}>
            <option value="">Mensual y anual</option>
            <option value="mensual">Solo mensual</option>
            <option value="anual">Solo anual</option>
          </select>
        </label>
        <label className={etiqueta}>
          Usos máximos
          <input name="usos_max" inputMode="numeric" defaultValue={cupon?.usos_max ?? ""} placeholder="Ilimitados" className={campo} />
        </label>
        <label className={etiqueta}>
          Vence
          <input type="date" name="hasta" defaultValue={cupon?.hasta?.slice(0, 10) ?? ""} className={campo} />
        </label>
      </div>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1.5 text-[13px] font-semibold text-cuerpo">Aplica a</legend>
        {planes.map((p) => (
          <label key={p.codigo} className="flex items-center gap-2">
            <input type="checkbox" name="planes" value={p.codigo} defaultChecked={cupon ? cupon.planes.includes(p.codigo) : p.codigo === "familia"} className="size-4 accent-monte" />
            {p.nombre}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={cupon?.activo ?? true} className="size-4 accent-monte" />
        Activo
      </label>
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="secundario" pendiente="Guardando…">
        {cupon ? "Guardar cupón" : "Crear cupón"}
      </BotonEnviar>
    </form>
  );
}
