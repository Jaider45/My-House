/**
 * Academia (diseño «Academia» y «Lección»): rutas de aprendizaje con lecciones escritas, cortas y en tuteo. Puro:
 * sin base ni React. El avance de cada persona se guarda en `user_metadata.academia` (claves «curso/lección»).
 * Los textos son orientativos: no reemplazan a un contador o asesor financiero (lo dice la pantalla).
 */
import type { NombreIcono } from "@/components/marca";
import type { IdGuia } from "@/lib/guias";

export type Bloque =
  | { p: string }
  | { h2: string }
  | { opciones: { titulo: string; texto: string }[] }
  | { aplica: { titulo: string; texto: string; href: string; boton: string } }
  | { guia: { id: IdGuia; texto: string } }
  | { quiz: { pregunta: string; opciones: string[]; correcta: number; bien: string; mal: string } };

export type Leccion = { slug: string; titulo: string; minutos: number; bloques: Bloque[] };

export type Tema = "app" | "finanzas" | "ahorro" | "renta" | "deudas";

export type Curso = {
  slug: string;
  titulo: string;
  /** Texto corto del encabezado de la tarjeta (miniatura). */
  portada: string;
  descripcion: string;
  tema: Tema;
  icono: NombreIcono;
  /** Color de la miniatura (diseño: monte, teja, mar, arena). */
  color: "monte" | "teja" | "mar" | "arena";
  lecciones: Leccion[];
};

export const TEMAS: Record<Tema, string> = {
  app: "Uso de la app",
  finanzas: "Finanzas",
  ahorro: "Ahorro",
  renta: "Renta DIAN",
  deudas: "Deudas",
};

export const CURSOS: Curso[] = [
  {
    slug: "empieza",
    titulo: "Empieza con My House",
    portada: "Empieza con My House",
    descripcion: "Registrar, pagos fijos, presupuesto y asistente: lo esencial para arrancar bien.",
    tema: "app",
    icono: "resumen",
    color: "monte",
    lecciones: [
      {
        slug: "registrar",
        titulo: "Registra un gasto en 10 segundos",
        minutos: 2,
        bloques: [
          { p: "Lo que no se registra no existe. La buena noticia: registrar un gasto en My House toma menos de lo que tardas en guardar el recibo en la billetera." },
          { h2: "Los tres datos que importan" },
          {
            opciones: [
              { titulo: "¿Cuánto?", texto: "El monto, sin puntos ni signos: My House los pone por ti." },
              { titulo: "¿En qué?", texto: "Escríbelo como se lo dirías a alguien: «droguería», «mercado», «Terpel»." },
              { titulo: "¿De dónde?", texto: "La cuenta o tarjeta. Recordamos la última que usaste en este celular." },
            ],
          },
          { p: "La segunda vez que escribas el mismo concepto, My House ya sabe en qué categoría va y de qué cuenta suele salir. Si se equivoca, toca «Cambiar»." },
          { p: "¿Lo vas a pagar después? Marca «Lo pago después»: queda pendiente en Movimientos hasta que lo marques como pagado. Y si estás sin señal, el registro se guarda en el celular y se envía solo cuando vuelva." },
          { guia: { id: "gasto", texto: "Te muestro dónde tocar, paso a paso, y registras tu primer gasto de verdad." } },
          {
            quiz: {
              pregunta: "Registraste «Terpel» la semana pasada en Transporte. ¿Qué pasa hoy si vuelves a escribir «Terpel»?",
              opciones: ["Tengo que elegir la categoría otra vez", "My House la sugiere solo", "No se puede repetir un concepto"],
              correcta: 1,
              bien: "Exacto. Lo que registras enseña a My House; tú solo confirmas.",
              mal: "Casi. My House recuerda el concepto y te sugiere la categoría y la cuenta.",
            },
          },
        ],
      },
      {
        slug: "pagos-fijos",
        titulo: "Cómo organizar los pagos fijos para que nada se venza",
        minutos: 3,
        bloques: [
          { p: "Arriendo, administración, servicios, colegio, planes de celular, cuotas: los pagos fijos son la base del costo de vida. Cargarlos una vez te ahorra registrarlos cada mes y evita los recargos por mora." },
          { h2: "Cómo funcionan en My House" },
          { p: "Creas el pago una sola vez con su monto, la fecha de un pago y cada cuánto se repite. Siete días antes de cada fecha aparece en Movimientos como pendiente; cuando lo pagas, lo marcas y listo." },
          {
            opciones: [
              { titulo: "Pendiente", texto: "Ya está programado y aún no vence. Lo ves en el calendario de Pagos fijos." },
              { titulo: "Vencido", texto: "Pasó la fecha y no lo marcaste. Sale en rojo y te avisamos por correo si lo pediste." },
              { titulo: "Pagado", texto: "Lo marcaste como pagado: ya cuenta como gasto del mes." },
            ],
          },
          { p: "Un truco: pon la fecha de pago unos días antes de la fecha límite real. Así tienes margen si el sueldo llega tarde." },
          { p: "¿Es la cuota de un crédito? Regístralo en Deudas: además de la cuota mensual verás cuánto te falta y cuándo terminas." },
          { guia: { id: "pago_fijo", texto: "Créalo conmigo: te ilumino cada campo del formulario." } },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Revisa el calendario del mes y marca lo que ya pagaste.", href: "/recurrentes", boton: "Ver pagos fijos" },
          },
        ],
      },
      {
        slug: "presupuesto",
        titulo: "Arma tu presupuesto en 5 minutos",
        minutos: 3,
        bloques: [
          { p: "En My House el presupuesto tiene dos partes: los pagos fijos, que ya cuentan solos, y el gasto variable que planeas en cada categoría: mercado, transporte, salidas." },
          { p: "No tienes que adivinar: al agregar un presupuesto te mostramos el promedio de tus últimos tres meses y dos opciones, un poco más o ahorrar el 10 %." },
          { h2: "El semáforo" },
          {
            opciones: [
              { titulo: "En rango", texto: "Lo gastado y el pronóstico están dentro de lo planeado." },
              { titulo: "Atento", texto: "A este ritmo te pasarás antes de que acabe el mes." },
              { titulo: "Excedido", texto: "Ya gastaste más de lo planeado en esa categoría." },
            ],
          },
          { guia: { id: "presupuesto", texto: "Te acompaño a poner tu primer presupuesto de gasto variable." } },
        ],
      },
      {
        slug: "asistente",
        titulo: "El asistente de comprobantes",
        minutos: 2,
        bloques: [
          { p: "Toma una foto de la factura, sube el PDF o una captura de Nequi o Daviplata. El asistente lee el comercio, la fecha y el monto, elige la categoría y lo registra." },
          { p: "Si el pago ya estaba (por ejemplo, un pago fijo que marcaste), no lo duplica: adjunta el archivo como soporte. Y si no está seguro de algo, te pregunta en Movimientos → Por revisar." },
          { p: "Cada comprobante queda guardado como soporte. En abril, cuando el contador pida los certificados de salud o las facturas del negocio, ya los tienes." },
          { guia: { id: "revisar", texto: "Te muestro cómo resolver lo que el asistente dejó por revisar." } },
        ],
      },
      {
        slug: "invitar",
        titulo: "Registren los dos y vean lo mismo",
        minutos: 2,
        bloques: [
          { p: "Las finanzas de la casa son de todos los que la sostienen. Invita a tu pareja para que registre desde su celular: los dos ven los mismos movimientos, el mismo presupuesto y los mismos pagos." },
          {
            opciones: [
              { titulo: "Pareja o familiar", texto: "Registra, edita y marca pagos." },
              { titulo: "Administrador", texto: "Además invita, quita personas y cambia la configuración." },
              { titulo: "Contador", texto: "Solo mira: movimientos, Renta DIAN y soportes." },
            ],
          },
          { guia: { id: "invitar", texto: "Te llevo a crear la invitación y compartir el enlace por WhatsApp." } },
        ],
      },
    ],
  },
  {
    slug: "finanzas",
    titulo: "Finanzas del hogar desde cero",
    portada: "Finanzas del hogar desde cero",
    descripcion: "Número mínimo, gastos fijos y variables, y cómo saber si te alcanza.",
    tema: "finanzas",
    icono: "casa",
    color: "teja",
    lecciones: [
      {
        slug: "numero-minimo",
        titulo: "¿Qué es el número mínimo del hogar?",
        minutos: 3,
        bloques: [
          { p: "El número mínimo es lo que la casa necesita cada mes para funcionar, pase lo que pase: los pagos fijos esenciales, los gastos esenciales del día a día y una cuota para imprevistos." },
          { p: "Es tu cifra más importante porque responde la pregunta que de verdad preocupa: si mañana entrara menos plata, ¿cuánto necesitamos sí o sí?" },
          { h2: "Cómo lo calcula My House" },
          {
            opciones: [
              { titulo: "Fijos esenciales", texto: "Arriendo o cuota de vivienda, servicios, colegio, salud, cuotas de deudas." },
              { titulo: "Variables esenciales", texto: "Mercado y transporte: lo presupuestado o lo que sueles gastar, lo que sea mayor." },
              { titulo: "Imprevistos", texto: "Un porcentaje sobre lo anterior (10 % por defecto) para lo que siempre aparece." },
            ],
          },
          { p: "Lo que no es esencial (salidas, ropa, suscripciones) queda por fuera. No porque esté mal gastar en eso, sino porque es lo primero que se puede ajustar si toca." },
          { p: "Úsalo para dos cosas: saber cuánto debe tener tu fondo de emergencia (de 3 a 6 veces el número mínimo) y para ver si tus ingresos lo cubren con holgura." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Mira tu número mínimo y cuántas veces lo cubren tus ingresos.", href: "/", boton: "Ver mi número mínimo" },
          },
          {
            quiz: {
              pregunta: "¿Cuál de estos gastos entra en el número mínimo?",
              opciones: ["La suscripción de streaming", "El mercado del mes", "Las salidas a comer"],
              correcta: 1,
              bien: "Exacto. El mercado es esencial; lo demás se puede ajustar si toca.",
              mal: "Casi. El número mínimo solo cuenta lo esencial: aquí, el mercado.",
            },
          },
        ],
      },
      {
        slug: "fijos-y-variables",
        titulo: "Gastos fijos y variables: dónde está el margen",
        minutos: 3,
        bloques: [
          { p: "Los gastos fijos se repiten con el mismo monto y casi en la misma fecha: arriendo, administración, colegio, planes. Los variables cambian cada mes: mercado, gasolina, domicilios, salidas." },
          { p: "Los fijos se deciden una vez (cambiar de plan de celular, renegociar el arriendo) y el ahorro dura todos los meses. Los variables se deciden todos los días, y ahí es donde se escapa la plata sin darte cuenta." },
          { h2: "Una regla práctica" },
          { p: "Si tus fijos pasan del 60 % de lo que entra, el mes se vuelve frágil: cualquier imprevisto descuadra. Revisa primero los fijos grandes; luego ponle presupuesto a dos o tres variables, no a todas." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "En Presupuesto ves cuánto son fijos y cuánto variable en cada categoría.", href: "/presupuesto", boton: "Ver presupuesto" },
          },
        ],
      },
      {
        slug: "presupuesto-que-se-cumple",
        titulo: "Cómo armar un presupuesto que sí se cumple",
        minutos: 4,
        bloques: [
          { p: "Un presupuesto que no se cumple casi siempre falla por lo mismo: se armó con lo que quisiéramos gastar y no con lo que de verdad gastamos." },
          { h2: "Tres pasos" },
          {
            opciones: [
              { titulo: "1. Parte de lo real", texto: "Usa el promedio de los últimos tres meses. My House te lo muestra al agregar cada categoría." },
              { titulo: "2. Ajusta pocas cosas", texto: "Elige dos o tres categorías para recortar. Si cambias todo a la vez, no se sostiene." },
              { titulo: "3. Mira el ritmo", texto: "El semáforo te avisa a mitad de mes si vas rápido, cuando aún hay tiempo de frenar." },
            ],
          },
          { p: "El amarillo no es un regaño: es información. Si a día 15 una categoría ya va en amarillo, puedes frenar o mover plata de otra. El rojo, en cambio, ya pasó: úsalo para planear mejor el mes siguiente." },
          { guia: { id: "presupuesto", texto: "Pon tu primer presupuesto con la guía." } },
        ],
      },
      {
        slug: "cuando-te-pasas",
        titulo: "Qué hacer cuando una categoría se pasa",
        minutos: 3,
        bloques: [
          { p: "Pasarse en una categoría le pasa a todo el mundo. Lo importante es qué haces con ese dato." },
          {
            opciones: [
              { titulo: "Fue algo puntual", texto: "Un regalo, un daño en la casa. No cambies el presupuesto: anótalo y sigue." },
              { titulo: "Pasa cada mes", texto: "Entonces el presupuesto está mal. Súbelo y baja otra categoría para compensar." },
              { titulo: "Te sorprendió", texto: "Revisa los movimientos de esa categoría: a veces son domicilios pequeños que suman mucho." },
            ],
          },
          { p: "Para salidas y restaurantes funciona bien decidir el número de salidas del mes, no el monto: «cuatro salidas» es más fácil de cumplir que «$450.000»." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Mira qué categorías van en amarillo o rojo este mes.", href: "/presupuesto", boton: "Ver el semáforo" },
          },
        ],
      },
    ],
  },
  {
    slug: "pareja",
    titulo: "Presupuesto en pareja",
    portada: "Presupuesto en pareja",
    descripcion: "Cómo repartir los gastos, decidir juntos y no pelear por plata.",
    tema: "finanzas",
    icono: "familia",
    color: "mar",
    lecciones: [
      {
        slug: "numeros-sobre-la-mesa",
        titulo: "Pongan sus números sobre la mesa",
        minutos: 3,
        bloques: [
          { p: "La plata es uno de los temas que más discusiones genera en una pareja, y casi nunca por la plata en sí: es por no saber. Quién gana cuánto, quién paga qué, cuánto cuesta la casa." },
          { p: "El primer paso es aburrido pero poderoso: que los dos vean los mismos números. Ingresos, pagos fijos, deudas y el número mínimo del hogar." },
          { p: "No se trata de vigilarse. Se trata de que las decisiones (cambiar de carro, irse de vacaciones, cambiar de colegio) se tomen con la misma información." },
          { guia: { id: "invitar", texto: "Invita a tu pareja para que registre y vea lo mismo que tú." } },
        ],
      },
      {
        slug: "como-repartir",
        titulo: "Cómo repartir los gastos de la casa",
        minutos: 5,
        bloques: [
          { p: "No hay una sola forma correcta de repartir los gastos. Lo que funciona es que los dos sepan cuál eligieron y por qué. Cuando no se habla, uno termina pagando de más y el otro sin saber cuánto cuesta la casa." },
          { h2: "Las tres formas más usadas" },
          {
            opciones: [
              { titulo: "Mitad y mitad", texto: "Cada uno pone lo mismo. Es simple, pero pesa más para quien gana menos." },
              { titulo: "Proporcional", texto: "Cada uno pone según lo que gana. Si uno gana el 65 % de los ingresos, pone el 65 % de los gastos." },
              { titulo: "Fondo común", texto: "Todo entra a una sola bolsa y de ahí se paga todo. Requiere mucha confianza y orden." },
            ],
          },
          { p: "Un ejemplo: si una persona gana $7.250.000 y la otra $4.600.000, el proporcional sería 61 % y 39 %. Sobre un número mínimo de $9.700.000, la primera pondría unos $5.917.000 y la segunda unos $3.783.000." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Con el número mínimo del hogar a la vista es más fácil calcular la parte de cada uno.", href: "/", boton: "Ver el número mínimo" },
          },
          {
            quiz: {
              pregunta: "Si los dos ganan distinto y quieren que el esfuerzo sea parejo, ¿cuál forma conviene?",
              opciones: ["Mitad y mitad", "Proporcional", "Fondo común"],
              correcta: 1,
              bien: "Exacto. El proporcional reparte según lo que gana cada uno.",
              mal: "Casi. La que reparte según lo que gana cada uno es la proporcional.",
            },
          },
        ],
      },
      {
        slug: "reunion-mensual",
        titulo: "Una reunión de plata al mes",
        minutos: 3,
        bloques: [
          { p: "Quince minutos al mes, el mismo día (por ejemplo, el primer domingo), con My House abierto. Con eso se evitan la mayoría de las sorpresas." },
          {
            opciones: [
              { titulo: "Cómo cerró el mes", texto: "¿Ahorramos lo que esperábamos? ¿Qué categoría se pasó?" },
              { titulo: "Qué viene", texto: "Pagos grandes del mes siguiente: matrícula, SOAT, impuestos, cumpleaños." },
              { titulo: "Una decisión", texto: "Solo una: subir el aporte a una meta, recortar algo, pagar una deuda antes." },
            ],
          },
          { p: "Reglas de la reunión: nada de reproches por gastos pasados y nada de decisiones grandes sin dormir sobre ellas." },
        ],
      },
    ],
  },
  {
    slug: "ahorro",
    titulo: "Ahorro y fondo de emergencia",
    portada: "Fondo de emergencia",
    descripcion: "Cuánto necesitas, dónde guardarlo y cómo llegar sin sufrir.",
    tema: "ahorro",
    icono: "ahorro",
    color: "arena",
    lecciones: [
      {
        slug: "cuanto-fondo",
        titulo: "¿Cuánto debe tener tu fondo de emergencia?",
        minutos: 4,
        bloques: [
          { p: "Un fondo de emergencia es plata guardada para vivir unos meses sin ingresos: si se pierde un empleo, si hay una enfermedad, si el negocio tiene un mal trimestre." },
          { h2: "¿Cuántos meses?" },
          {
            opciones: [
              { titulo: "3 meses", texto: "Si en la casa hay dos ingresos estables y de empleo formal." },
              { titulo: "6 meses", texto: "Si hay un solo ingreso, o si es independiente o variable." },
              { titulo: "Más", texto: "Si hay personas a cargo con necesidades de salud, o el sector es inestable." },
            ],
          },
          { p: "La base no son tus gastos totales sino el número mínimo del hogar: en una emergencia recortas lo no esencial. Por eso en My House el fondo se mide en meses del número mínimo." },
          { p: "No tiene que estar completo mañana. Lo importante es que exista y crezca cada mes, aunque sea poco." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Crea la meta «Fondo de emergencia» y te decimos cuánto apartar al mes.", href: "/metas", boton: "Ir a Metas" },
          },
          { guia: { id: "meta", texto: "Crea tu fondo de emergencia con la guía." } },
        ],
      },
      {
        slug: "donde-guardarlo",
        titulo: "Dónde guardar el fondo",
        minutos: 3,
        bloques: [
          { p: "El fondo de emergencia tiene que cumplir tres cosas: que no pierda valor, que lo puedas sacar en pocos días y que no esté tan a la mano que te lo gastes." },
          {
            opciones: [
              { titulo: "Cuenta de ahorros aparte", texto: "Distinta de la del día a día. Fácil, pero renta poco." },
              { titulo: "Cuentas o bolsillos de alto rendimiento", texto: "Varias entidades pagan más intereses con retiro inmediato. Compara la tasa efectiva anual." },
              { titulo: "CDT corto", texto: "Para la parte que no necesitarías en el primer mes. Escalónalos para que venzan en fechas distintas." },
            ],
          },
          { p: "Evita las inversiones que pueden bajar de valor (acciones, criptomonedas) para esta plata: justo cuando la necesites puede valer menos." },
        ],
      },
      {
        slug: "subir-el-aporte",
        titulo: "Cómo subir el aporte sin sentirlo",
        minutos: 3,
        bloques: [
          { p: "La forma más fácil de ahorrar es que el ahorro salga primero, el día que llega el sueldo, como un pago fijo más." },
          {
            opciones: [
              { titulo: "Ahorro automático", texto: "Crea un pago fijo a la meta el día de pago. Lo que no ves, no lo gastas." },
              { titulo: "Sube con cada aumento", texto: "Cuando te suban el sueldo, sube el aporte la mitad del aumento." },
              { titulo: "Plata extra", texto: "Primas, bonos y devoluciones: una parte fija va directo a la meta." },
            ],
          },
          { p: "Si la meta va atrasada, My House te dice cuánto subir el aporte para llegar a tiempo. A veces son $50.000 al mes." },
        ],
      },
    ],
  },
  {
    slug: "renta",
    titulo: "Renta para personas naturales",
    portada: "Renta sin enredos",
    descripcion: "Topes, UVT, deducciones y qué soportes guardar desde enero.",
    tema: "renta",
    icono: "declaracion-renta",
    color: "monte",
    lecciones: [
      {
        slug: "quien-declara",
        titulo: "¿Quién debe declarar renta?",
        minutos: 4,
        bloques: [
          { p: "En Colombia, una persona natural debe declarar renta si en el año superó cualquiera de los topes que fija la DIAN. Basta con uno." },
          { h2: "Los topes, en UVT" },
          {
            opciones: [
              { titulo: "Ingresos brutos", texto: "1.400 UVT en el año: salario, honorarios, arriendos, ventas." },
              { titulo: "Patrimonio bruto", texto: "4.500 UVT al 31 de diciembre: cuentas, inmuebles, carro, inversiones." },
              { titulo: "Consumos y movimientos", texto: "1.400 UVT en consumos con tarjeta, en compras totales o en consignaciones e inversiones." },
            ],
          },
          { p: "La UVT (Unidad de Valor Tributario) cambia cada año. En Renta DIAN ves su valor y los topes ya convertidos a pesos." },
          { p: "Los topes son por persona, no por hogar. Por eso My House lleva un semáforo para cada adulto." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Mira el semáforo de cada persona del hogar.", href: "/impuestos", boton: "Ver Renta DIAN" },
          },
          {
            quiz: {
              pregunta: "Camila ganó menos del tope de ingresos, pero sus consumos con tarjeta lo superaron. ¿Debe declarar?",
              opciones: ["No, solo cuentan los ingresos", "Sí, basta con superar un tope", "Solo si tiene carro"],
              correcta: 1,
              bien: "Exacto. Superar cualquiera de los topes obliga a declarar.",
              mal: "Casi. Basta con superar uno de los topes, sea cual sea.",
            },
          },
        ],
      },
      {
        slug: "soportes",
        titulo: "Los soportes que debes guardar desde enero",
        minutos: 4,
        bloques: [
          { p: "La declaración se hace entre agosto y octubre, pero los soportes se juntan durante todo el año. Buscarlos en agosto es la forma más segura de perder deducciones." },
          {
            opciones: [
              { titulo: "Certificado de ingresos y retenciones", texto: "Lo entrega la empresa en marzo. Si tienes varios empleadores, uno de cada uno." },
              { titulo: "Salud y pensión", texto: "Certificados de medicina prepagada, seguros de salud y aportes voluntarios a pensión o AFC." },
              { titulo: "Bancos", texto: "Certificados de saldos al 31 de diciembre, intereses y el 4 × 1.000 pagado." },
            ],
          },
          { p: "Si tienes negocio o eres independiente, guarda también las facturas de los costos. En My House marca esos gastos como «Negocio» y súbelos con el asistente: quedan como soporte." },
          { p: "Para dependientes (hijos, padres a cargo) guarda el registro civil o el soporte de la dependencia." },
        ],
      },
      {
        slug: "deducciones",
        titulo: "Deducciones que más se olvidan",
        minutos: 4,
        bloques: [
          { p: "Las deducciones bajan el impuesto, pero solo si tienes cómo probarlas. Estas son las que más se pierden por no guardar el soporte." },
          {
            opciones: [
              { titulo: "Dependientes", texto: "Un porcentaje de los ingresos laborales, con tope, más un valor adicional por cada dependiente." },
              { titulo: "Medicina prepagada", texto: "Los pagos de salud prepagada o seguros de salud, con un tope mensual." },
              { titulo: "4 × 1.000", texto: "La mitad del gravamen a los movimientos financieros pagado en el año." },
            ],
          },
          { p: "Los topes exactos cambian con la ley y se expresan en UVT. Tu contador los confirma; tú solo asegúrate de tener los certificados." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Revisa qué personas a cargo pueden contar como dependientes.", href: "/ajustes/miembros", boton: "Ver personas a cargo" },
          },
        ],
      },
    ],
  },
  {
    slug: "deudas",
    titulo: "Deudas sin miedo",
    portada: "Deudas sin miedo",
    descripcion: "Bola de nieve vs. avalancha, tarjetas de crédito y cómo negociar.",
    tema: "deudas",
    icono: "deducciones",
    color: "teja",
    lecciones: [
      {
        slug: "bola-de-nieve-o-avalancha",
        titulo: "Bola de nieve o avalancha: cuál deuda pagar primero",
        minutos: 4,
        bloques: [
          { p: "Si tienes varias deudas y algo de plata extra cada mes, la pregunta es a cuál abonarle primero. Hay dos métodos, y los dos funcionan si los sostienes." },
          {
            opciones: [
              { titulo: "Bola de nieve", texto: "Pagas primero la deuda más pequeña. Terminarla rápido da impulso para seguir." },
              { titulo: "Avalancha", texto: "Pagas primero la de mayor tasa de interés. Matemáticamente es la que menos intereses te cobra." },
              { titulo: "En ambos", texto: "Pagas la cuota mínima de todas y el extra va solo a una. Cuando la terminas, su cuota se suma a la siguiente." },
            ],
          },
          { p: "Si te cuesta ser constante, empieza con bola de nieve. Si tienes una tarjeta de crédito con interés alto, la avalancha casi siempre gana." },
          {
            aplica: { titulo: "Aplícalo en My House", texto: "Mira cuánto te falta en cada deuda y cuándo terminas.", href: "/deudas", boton: "Ver deudas" },
          },
          { guia: { id: "deuda", texto: "Registra tus deudas con la guía para ver el avance." } },
        ],
      },
      {
        slug: "tarjeta-de-credito",
        titulo: "La tarjeta de crédito, sin sustos",
        minutos: 3,
        bloques: [
          { p: "La tarjeta de crédito no es plata extra: es plata que ya gastaste y debes pagar el día límite. Usada así es una herramienta; usada como ingreso, una trampa." },
          {
            opciones: [
              { titulo: "Paga el total", texto: "Si pagas el total del periodo antes del día límite, normalmente no pagas intereses." },
              { titulo: "Cuidado con las cuotas", texto: "Diferir una compra a muchas cuotas cobra intereses en cada una. Para mercado o salidas, a una cuota." },
              { titulo: "Avances", texto: "Sacar efectivo con la tarjeta suele tener los intereses más altos. Evítalo." },
            ],
          },
          { p: "En My House el pago de la tarjeta es una transferencia de tu cuenta a la tarjeta: el gasto ya contó el día que compraste. Así no se cuenta doble." },
        ],
      },
      {
        slug: "negociar",
        titulo: "Cómo negociar una deuda",
        minutos: 3,
        bloques: [
          { p: "Si una cuota se volvió imposible, llamar al banco antes de atrasarte es mucho mejor que esperar el cobro. Los bancos prefieren reestructurar a perder la plata." },
          {
            opciones: [
              { titulo: "Prepárate", texto: "Ten a mano cuánto debes, la tasa, cuánto puedes pagar al mes de verdad y por qué cambió tu situación." },
              { titulo: "Pide opciones", texto: "Ampliar el plazo, bajar la tasa, unificar deudas o un periodo de gracia." },
              { titulo: "Por escrito", texto: "Cualquier acuerdo, que quede por escrito antes de pagar." },
            ],
          },
          { p: "Un plazo más largo baja la cuota pero sube el total pagado. Úsalo para respirar, y cuando puedas, abona a capital." },
        ],
      },
    ],
  },
];

export const GLOSARIO: { termino: string; texto: string }[] = [
  { termino: "Número mínimo", texto: "Lo que la casa necesita cada mes: pagos fijos, gastos esenciales y una cuota para imprevistos." },
  { termino: "Costo de vida", texto: "Lo que cuesta sostener la casa en el mes, por categoría: lo presupuestado o lo gastado si es más." },
  { termino: "UVT", texto: "Unidad de Valor Tributario. La DIAN la fija cada año y con ella se calculan los topes." },
  { termino: "Fondo de emergencia", texto: "Plata guardada para vivir de 3 a 6 meses sin ingresos." },
  { termino: "GMF o 4 × 1.000", texto: "Impuesto a los movimientos bancarios. La mitad de lo pagado se puede deducir en la renta." },
  { termino: "Pago fijo", texto: "Un gasto que se repite con el mismo monto: arriendo, servicios, colegio, planes." },
  { termino: "Gasto variable", texto: "Lo que cambia cada mes: mercado, transporte, salidas. Ahí está el margen para ajustar." },
  { termino: "Pronóstico de cierre", texto: "Cuánto habrás gastado el último día del mes si sigues al mismo ritmo." },
];

export const claveLeccion = (curso: string, leccion: string) => `${curso}/${leccion}`;

export const cursoPorSlug = (slug: string) => CURSOS.find((c) => c.slug === slug);

export function leccionDe(curso: string, leccion: string) {
  const c = cursoPorSlug(curso);
  const i = c?.lecciones.findIndex((l) => l.slug === leccion) ?? -1;
  if (!c || i < 0) return null;
  return { curso: c, leccion: c.lecciones[i], indice: i, anterior: c.lecciones[i - 1], siguiente: c.lecciones[i + 1] };
}

/** Lecciones vistas de `user_metadata.academia`: solo claves que existen. */
export function leerVistasAcademia(metadata: unknown): string[] {
  const lista = (metadata as { academia?: unknown } | null | undefined)?.academia;
  if (!Array.isArray(lista)) return [];
  const validas = new Set(CURSOS.flatMap((c) => c.lecciones.map((l) => claveLeccion(c.slug, l.slug))));
  return lista.filter((x): x is string => typeof x === "string" && validas.has(x));
}

/** Avance de un curso: lecciones vistas, minutos que faltan y la siguiente por ver. */
export function avanceCurso(curso: Curso, vistas: Set<string>) {
  const hechas = curso.lecciones.filter((l) => vistas.has(claveLeccion(curso.slug, l.slug)));
  const pendientes = curso.lecciones.filter((l) => !vistas.has(claveLeccion(curso.slug, l.slug)));
  return {
    hechas: hechas.length,
    total: curso.lecciones.length,
    porcentaje: Math.round((hechas.length * 100) / curso.lecciones.length),
    faltanMinutos: pendientes.reduce((s, l) => s + l.minutos, 0),
    siguiente: pendientes[0] ?? null,
    completo: pendientes.length === 0,
  };
}

/** «Sigue donde ibas»: el curso empezado y sin terminar con más avance. */
export function continuar(vistas: Set<string>) {
  return (
    CURSOS.map((c) => ({ curso: c, ...avanceCurso(c, vistas) }))
      .filter((a) => a.hechas > 0 && !a.completo)
      .sort((a, b) => b.porcentaje - a.porcentaje)[0] ?? null
  );
}

/** Búsqueda simple en títulos y textos de las lecciones (sin tildes ni mayúsculas). */
export function buscar(texto: string) {
  const n = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const q = n(texto.trim());
  if (q.length < 2) return [];
  return CURSOS.flatMap((c) =>
    c.lecciones
      .filter((l) => n(`${l.titulo} ${l.bloques.map((b) => ("p" in b ? b.p : "h2" in b ? b.h2 : "")).join(" ")}`).includes(q))
      .map((l) => ({ curso: c, leccion: l })),
  );
}
