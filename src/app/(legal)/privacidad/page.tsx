import Link from "next/link";
import { RESPONSABLE as R } from "@/lib/legal/responsable";
import { Encabezado, Lista, Seccion } from "../piezas";

export const metadata = { title: "Política de tratamiento de datos" };

const correo = (
  <a className="font-semibold text-monte underline underline-offset-2" href={`mailto:${R.correoDatos}`}>
    {R.correoDatos}
  </a>
);

export default function Privacidad() {
  return (
    <>
      <Encabezado titulo="Política de tratamiento de datos personales">
        <p>
          Esta política explica cómo My House recoge, usa, guarda y protege tus datos personales, conforme a la Ley 1581
          de 2012, el Decreto 1074 de 2015 (capítulo 25) y las demás normas colombianas de protección de datos.
        </p>
      </Encabezado>

      <Seccion n={1} titulo="Responsable del tratamiento">
        <Lista>
          <li>
            <strong>{R.nombre}</strong>, identificado con {R.identificacion}.
          </li>
          <li>Domicilio: {R.direccion}.</li>
          <li>Teléfono: {R.telefono}.</li>
          <li>Correo para consultas y reclamos sobre tus datos: {correo}.</li>
          <li>Sitio web: {R.sitio}.</li>
        </Lista>
      </Seccion>

      <Seccion n={2} titulo="Qué datos tratamos">
        <Lista>
          <li>
            <strong>De tu cuenta:</strong> nombre, correo, contraseña (guardada cifrada; nadie puede leerla), y si la
            activas, la configuración de verificación en dos pasos.
          </li>
          <li>
            <strong>De tu hogar:</strong> nombre del hogar, ciudad, personas que lo integran, cuentas, ingresos, gastos,
            pagos fijos, deudas, metas, presupuestos y los soportes que subes (fotos, PDF y extractos).
          </li>
          <li>
            <strong>De las personas a cargo</strong> que registras (por ejemplo, hijos o padres): nombre, parentesco,
            fecha de nacimiento y notas que tú escribas.
          </li>
          <li>
            <strong>Tributarios:</strong> los dos últimos dígitos de la cédula (para el calendario de la DIAN), si los
            escribes.
          </li>
          <li>
            <strong>De pago:</strong> plan, fechas y estado de los cobros. Los datos de tu tarjeta o cuenta bancaria los
            recibe directamente Wompi; My House no los ve ni los guarda.
          </li>
          <li>
            <strong>Técnicos:</strong> dirección IP, navegador, fecha de ingreso y registros de errores (sin montos),
            para seguridad, prevención de fraude y soporte.
          </li>
        </Lista>
        <p>
          No pedimos datos sensibles (salud, origen étnico, orientación política o religiosa, datos biométricos). Te
          pedimos no escribirlos en las notas ni en las descripciones de los movimientos.
        </p>
      </Seccion>

      <Seccion n={3} titulo="Para qué los usamos (finalidades)">
        <Lista>
          <li>Crear y administrar tu cuenta y tu hogar, y permitir que las personas que invitas vean la misma información.</li>
          <li>Calcular el costo de vida, el número mínimo, los presupuestos, los pagos pendientes y el semáforo de renta.</li>
          <li>
            Leer comprobantes y extractos con inteligencia artificial, solo cuando tú los subes, para proponerte el
            movimiento y su categoría.
          </li>
          <li>Enviarte correos del servicio: códigos de acceso, avisos de seguridad, recordatorios de pago, resúmenes y avisos de la DIAN que actives.</li>
          <li>Cobrar el plan que elijas, emitir la factura y gestionar renovaciones, reembolsos y pagos fallidos.</li>
          <li>Atender tus solicitudes de soporte y las consultas o reclamos sobre tus datos.</li>
          <li>Proteger el servicio: detectar accesos sospechosos, abuso y fraude.</li>
          <li>Medir el uso del servicio de forma agregada para mejorarlo (sin vender ni ceder tus datos).</li>
          <li>
            Solo si lo autorizas aparte: enviarte novedades y promociones de My House. Puedes retirar esta autorización
            cuando quieras desde Recordatorios o con el enlace de cada correo.
          </li>
        </Lista>
        <p>
          My House <strong>no vende</strong> tus datos ni los usa para publicidad de terceros. Los proveedores de
          inteligencia artificial que usamos no entrenan sus modelos con lo que les enviamos.
        </p>
      </Seccion>

      <Seccion n={4} titulo="Quién más trata tus datos (encargados) y transmisión internacional">
        <p>Para prestar el servicio, estos proveedores tratan datos por cuenta nuestra y bajo nuestras instrucciones:</p>
        <Lista>
          <li>Supabase Inc. (Estados Unidos): base de datos, archivos y acceso a la cuenta.</li>
          <li>Vercel Inc. (Estados Unidos): servidores donde funciona la aplicación.</li>
          <li>Resend (Estados Unidos): envío de correos.</li>
          <li>OpenAI y Anthropic (Estados Unidos): lectura de comprobantes y extractos que subes.</li>
          <li>Wompi, de Bancolombia S.A. (Colombia): procesamiento de pagos.</li>
          <li>Cloudflare (Estados Unidos) y Google (Estados Unidos), si usas el captcha o el ingreso con Google.</li>
        </Lista>
        <p>
          Varios de ellos guardan la información fuera de Colombia, principalmente en Estados Unidos. Al aceptar esta
          política autorizas esa <strong>transmisión internacional</strong>, que se hace con proveedores que ofrecen
          niveles adecuados de seguridad y que solo pueden usar los datos para prestarnos el servicio.
        </p>
        <p>
          Dentro de tu hogar, la información la ven las personas que el administrador invita, según su rol. Un contador
          invitado solo puede leer. El equipo de My House no ve tus movimientos ni tus saldos: si necesitas ayuda con
          ellos, te pediremos acceso y tú decides si lo apruebas, por cuánto tiempo, y puedes revocarlo.
        </p>
        <p>Solo entregaremos datos a una autoridad cuando una norma o una orden judicial o administrativa lo exija.</p>
      </Seccion>

      <Seccion n={5} titulo="Datos de niños, niñas y adolescentes">
        <p>
          My House es para personas mayores de edad. Los datos de menores que registres como personas a cargo los
          tratamos solo para las finalidades de tu hogar (por ejemplo, la orientación sobre dependientes en la
          declaración de renta), respetando su interés superior y sus derechos fundamentales. Al registrarlos declaras
          que eres su representante legal o que cuentas con su autorización.
        </p>
      </Seccion>

      <Seccion n={6} titulo="Tus derechos">
        <p>Como titular de los datos tienes derecho a:</p>
        <Lista>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Pedir prueba de la autorización que nos diste.</li>
          <li>Saber qué uso le hemos dado a tus datos.</li>
          <li>Revocar la autorización y pedir que borremos tus datos, cuando no haya un deber legal de conservarlos.</li>
          <li>Acceder gratis a tus datos.</li>
          <li>
            Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber hecho la consulta o
            el reclamo ante nosotros.
          </li>
        </Lista>
        <p>
          Muchos de estos derechos los ejerces directamente en la app: editar tu perfil y tu hogar, borrar movimientos o
          soportes, y apagar los correos de novedades.
        </p>
      </Seccion>

      <Seccion n={7} titulo="Cómo hacer una consulta o un reclamo">
        <p>
          Escríbenos a {correo} desde el correo de tu cuenta, o desde <Link className="font-semibold text-monte underline underline-offset-2" href="/ayuda">Ayuda</Link> en la app.
          Indica tu nombre, tu identificación, qué pides y, si es un reclamo, los hechos y los documentos que quieras
          aportar. Si actúas en nombre de otra persona, adjunta el documento que te autoriza.
        </p>
        <Lista>
          <li>
            <strong>Consultas</strong> (qué datos tenemos, cómo los usamos): respondemos en máximo 10 días hábiles,
            prorrogables una vez por 5 días hábiles más, avisándote el motivo.
          </li>
          <li>
            <strong>Reclamos</strong> (corregir, actualizar, borrar, revocar la autorización o reportar un incumplimiento):
            respondemos en máximo 15 días hábiles, prorrogables una vez por 8 días hábiles más. Si el reclamo está
            incompleto te pediremos lo que falta dentro de los 5 días siguientes; si no lo envías en 2 meses,
            entenderemos que desististe.
          </li>
        </Lista>
      </Seccion>

      <Seccion n={8} titulo="Cuánto tiempo guardamos tus datos">
        <Lista>
          <li>Los datos de tu cuenta y tu hogar, mientras tengas la cuenta.</li>
          <li>
            Si pides borrarlos, eliminamos la cuenta, los soportes y los hogares en los que eres la única persona con
            cuenta. En un hogar compartido, se borra tu acceso y la información del hogar sigue disponible para las demás
            personas.
          </li>
          <li>
            Los datos de cobros y facturación los conservamos por el tiempo que exigen las normas contables y
            tributarias.
          </li>
          <li>Los registros técnicos y de correos enviados, 90 días.</li>
          <li>La prueba de tu autorización, mientras exista la cuenta y el tiempo necesario para atender reclamos.</li>
        </Lista>
      </Seccion>

      <Seccion n={9} titulo="Seguridad">
        <p>
          Ciframos la información en tránsito y en reposo, aislamos los datos de cada hogar en la base de datos, ofrecemos
          verificación en dos pasos y exigimos verificación en dos pasos a todo el equipo de My House. Cada acción del
          equipo queda registrada en un historial que no se puede modificar. Ningún sistema es infalible: si ocurre un
          incidente que afecte tus datos, te avisaremos y lo reportaremos a la SIC como lo exige la ley.
        </p>
      </Seccion>

      <Seccion n={10} titulo="Cookies">
        <p>
          Usamos solo cookies necesarias: mantener tu sesión, recordar este navegador para avisarte de ingresos desde
          dispositivos nuevos y saber de qué campaña o contador llegaste. No usamos cookies de publicidad.
        </p>
      </Seccion>

      <Seccion n={11} titulo="Cambios y vigencia">
        <p>
          Esta política rige desde la fecha de la versión indicada arriba. Si la cambiamos de forma sustancial te
          avisaremos por correo o en la app y, cuando la ley lo exija, te pediremos aceptarla de nuevo.
        </p>
      </Seccion>
    </>
  );
}
