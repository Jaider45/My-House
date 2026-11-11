"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Campo, Casilla, CuadroIcono, Selector, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { CasillasLegales } from "@/components/casillas-legales";
import { digitosAMonto, formatearCOP, formatearMiles } from "@/lib/dinero";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { invitarMiembro } from "@/app/(app)/ajustes/acciones";
import { crearHogar, guardarPagosFijos } from "./acciones";
import { CATEGORIAS_PAGO, MAX_OTROS, PAGOS_SUGERIDOS } from "./pagos";

const pie = "sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 bg-pagina px-4 pt-3 pb-1 md:static md:mx-0 md:bg-transparent md:p-0";

function Contador({ etiqueta, nombre, inicial }: { etiqueta: string; nombre: string; inicial: number }) {
  const [n, setN] = useState(inicial);
  return (
    <span className="inline-flex items-center gap-3 rounded-[10px] border border-control py-1 pr-1.5 pl-3.5 font-semibold">
      {etiqueta}
      <button type="button" aria-label={`Quitar ${etiqueta.toLowerCase()}`} onClick={() => setN(Math.max(0, n - 1))} className="size-9 rounded-lg hover:bg-mosaico">
        −
      </button>
      <b aria-live="polite">{n}</b>
      <button type="button" aria-label={`Agregar ${etiqueta.toLowerCase()}`} onClick={() => setN(Math.min(10, n + 1))} className="size-9 rounded-lg hover:bg-mosaico">
        +
      </button>
      <input type="hidden" name={nombre} value={n} />
    </span>
  );
}

export function FormularioHogar({ nombre, pedirConsentimiento }: { nombre: string; pedirConsentimiento: boolean }) {
  const [estado, accion] = useActionState(crearHogar, null);
  return (
    <form action={accion} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
        <Campo etiqueta="Nombre del hogar" name="hogar" placeholder="Hogar Martínez Rojas" required maxLength={80} autoFocus />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tu nombre" name="nombre" defaultValue={nombre} required maxLength={80} />
          <Campo etiqueta="Ciudad" name="ciudad" placeholder="Bogotá" maxLength={60} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-cuerpo">¿Quiénes viven en la casa?</span>
          <div className="flex flex-wrap gap-3">
            <Contador etiqueta="Niños" nombre="ninos" inicial={0} />
            <Contador etiqueta="Otros a cargo" nombre="otros" inicial={0} />
          </div>
          <span className="text-[13px] text-tenue">
            «Otros a cargo»: padres, abuelos u otros familiares que dependen del hogar. Los adultos con ingresos entran con su propia cuenta:
            los invitas en el paso 3.
          </span>
        </div>
      </div>
      {pedirConsentimiento && <CasillasLegales />}
      <MensajeEstado estado={estado} />
      <div className={pie}>
        <BotonEnviar className="ml-auto h-12 min-w-[180px] flex-1 md:flex-none" pendiente="Creando…">
          Continuar
        </BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioPagosFijos() {
  const [estado, accion] = useActionState(guardarPagosFijos, null);
  const [montos, setMontos] = useState<Record<string, number>>({});
  const [otros, setOtros] = useState(1);
  const total = Object.values(montos).reduce((s, n) => s + n, 0);
  const campoMonto = (clave: string, etiqueta: string) => (
    <span className="flex h-9 w-[130px] items-center rounded-lg border border-control bg-elevada px-2.5 text-sm">
      <span className="text-cuerpo">$</span>
      <input
        name={`monto:${clave}`}
        inputMode="numeric"
        aria-label={`Monto de ${etiqueta}`}
        placeholder="0"
        value={montos[clave] ? formatearMiles(montos[clave]) : ""}
        onChange={(e) => setMontos({ ...montos, [clave]: digitosAMonto(e.target.value) })}
        className="w-full bg-transparent text-right outline-none"
      />
    </span>
  );
  const campoDia = (clave: string, etiqueta: string, dia: number) => (
    <select name={`dia:${clave}`} defaultValue={dia} aria-label={`Día de pago de ${etiqueta}`} className="h-9 w-24 rounded-lg border border-control bg-elevada px-2 text-sm">
      {Array.from({ length: 28 }, (_, i) => (
        <option key={i + 1} value={i + 1}>
          Día {i + 1}
        </option>
      ))}
    </select>
  );
  return (
    <form action={accion} className="flex flex-col gap-6">
      <div className="rounded-2xl border border-borde bg-elevada px-4 py-2 md:px-6">
        {PAGOS_SUGERIDOS.map((p) => (
          <div key={p.clave} className="flex min-h-16 flex-wrap items-center gap-3 border-b border-divisor py-2">
            <CuadroIcono nombre={iconoCategoria(p.categoria)} />
            <b className="flex-[1_1_120px]">{p.nombre}</b>
            {campoMonto(p.clave, p.nombre)}
            {campoDia(p.clave, p.nombre, p.dia)}
          </div>
        ))}
        {Array.from({ length: otros }, (_, i) => (
          <div key={i} className="flex min-h-16 flex-wrap items-center gap-3 border-b border-divisor py-2">
            <CuadroIcono nombre="calendario" />
            <input
              name={`otro:nombre:${i}`}
              placeholder="Otro pago (internet, seguro, gimnasio…)"
              aria-label={`Nombre del pago ${i + 1}`}
              maxLength={120}
              className="h-9 min-w-0 flex-[1_1_160px] rounded-lg border border-control px-2.5 text-sm"
            />
            <select name={`otro:categoria:${i}`} defaultValue="Servicios públicos" aria-label={`Categoría del pago ${i + 1}`} className="h-9 rounded-lg border border-control bg-elevada px-2 text-sm">
              {CATEGORIAS_PAGO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {campoMonto(`otro${i}`, `pago ${i + 1}`)}
            {campoDia(`otro${i}`, `pago ${i + 1}`, 1)}
          </div>
        ))}
        {otros < MAX_OTROS && (
          <button type="button" onClick={() => setOtros(otros + 1)} className="inline-flex h-12 items-center gap-2 text-sm font-semibold text-monte hover:underline">
            + Agregar otro pago fijo
          </button>
        )}
      </div>
      <p className="-mt-3 text-[13px] text-tenue">
        ¿Te faltó alguno? Después puedes agregar todos los que quieras en <b>Presupuesto</b> (o en Pagos fijos).
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-seleccion px-4 py-3.5">
        <span className="text-cuerpo">Total de pagos fijos hasta ahora</span>
        <b className="text-xl">{formatearCOP(total)}</b>
      </div>
      <MensajeEstado estado={estado} />
      <div className={pie}>
        {/* Pasa por la acción (sin guardar montos) para que también llegue el correo de bienvenida. */}
        <button type="submit" name="omitir" value="1" formNoValidate className="inline-flex h-12 items-center px-2 font-semibold text-cuerpo hover:text-tinta">
          Omitir
        </button>
        <BotonEnviar className="ml-auto h-12 min-w-[180px] flex-1 md:flex-none" pendiente="Guardando…">
          Continuar
        </BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioInvitarPareja() {
  const [estado, accion] = useActionState(invitarMiembro, null);
  const [contador, setContador] = useState(false);
  const [estadoContador, accionContador] = useActionState(invitarMiembro, null);
  const mensaje = (enlace: string) => `https://wa.me/?text=${encodeURIComponent(`Te invito a nuestro hogar en My House: ${enlace}`)}`;
  return (
    <div className="flex flex-col gap-6">
      <form action={accion} className="flex flex-col gap-4 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
        <Campo etiqueta="Correo de tu pareja" name="email" type="email" placeholder="nombre@correo.com" required />
        <Selector etiqueta="Rol" name="rol" defaultValue="editor">
          <option value="editor">Pareja · registra y edita</option>
          <option value="admin">Pareja · también administra</option>
        </Selector>
        <MensajeEstado estado={estado} />
        {estado?.enlace ? (
          <a href={mensaje(estado.enlace)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 self-start rounded-lg border border-cuerpo px-4 font-semibold hover:bg-mosaico">
            Enviar el enlace por WhatsApp
          </a>
        ) : (
          <BotonEnviar variante="secundario" className="self-start" pendiente="Creando enlace…">
            Crear enlace de invitación
          </BotonEnviar>
        )}
        <div className="border-t border-divisor pt-3.5">
          <Casilla etiqueta="Invitar también a mi contador (solo lectura)" checked={contador} onChange={(e) => setContador(e.target.checked)} />
        </div>
      </form>
      {contador && (
        <form action={accionContador} className={cx("flex flex-col gap-4 rounded-2xl border border-borde bg-elevada p-4 md:p-6")}>
          <input type="hidden" name="rol" value="contador" />
          <Campo etiqueta="Correo del contador" name="email" type="email" required />
          <MensajeEstado estado={estadoContador} />
          {estadoContador?.enlace ? (
            <a href={mensaje(estadoContador.enlace)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center self-start rounded-lg border border-cuerpo px-4 font-semibold hover:bg-mosaico">
              Enviar el enlace por WhatsApp
            </a>
          ) : (
            <BotonEnviar variante="secundario" className="self-start">
              Crear enlace para el contador
            </BotonEnviar>
          )}
        </form>
      )}
      <div className={pie}>
        <Link href="/onboarding?paso=2" className="inline-flex h-12 items-center px-2 font-semibold text-cuerpo hover:text-tinta">
          Atrás
        </Link>
        <Link href="/" className="ml-auto inline-flex h-12 min-w-[180px] flex-1 items-center justify-center rounded-lg bg-monte px-4 font-semibold text-arena md:flex-none">
          {estado?.enlace ? "Terminar" : "Hacerlo después"}
        </Link>
      </div>
    </div>
  );
}
