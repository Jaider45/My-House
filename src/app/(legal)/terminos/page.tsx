import Link from "next/link";
import { RESPONSABLE as R } from "@/lib/legal/responsable";
import { Encabezado, Lista, Seccion } from "../piezas";

export const metadata = { title: "Términos y condiciones" };

const enlace = "font-semibold text-monte underline underline-offset-2";

export default function Terminos() {
  return (
    <>
      <Encabezado titulo="Términos y condiciones de uso">
        <p>
          Estos términos regulan el uso de My House, el servicio en línea para registrar las finanzas de tu hogar que
          ofrece <strong>{R.nombre}</strong> ({R.identificacion}), con domicilio en {R.direccion} («My House»,
          «nosotros»). Al crear una cuenta los aceptas.
        </p>
      </Encabezado>

      <Seccion n={1} titulo="El servicio">
        <p>
          My House te permite registrar ingresos, gastos, pagos fijos, deudas y metas; calcular el costo de vida de tu
          hogar; compartirlo con las personas que invites; leer comprobantes con inteligencia artificial y ver una
          orientación sobre la declaración de renta.
        </p>
        <p>
          <strong>My House no es asesoría contable, tributaria, financiera ni legal.</strong> El semáforo de renta, los
          topes de la DIAN, la orientación sobre dependientes y los cálculos son orientativos y dependen de lo que
          registras. Antes de declarar o tomar decisiones importantes, consulta a un contador. Las lecturas de la
          inteligencia artificial pueden tener errores: revísalas.
        </p>
      </Seccion>

      <Seccion n={2} titulo="Tu cuenta">
        <Lista>
          <li>Debes ser mayor de edad y dar información verdadera.</li>
          <li>
            Eres responsable de cuidar tu contraseña y lo que se haga con tu cuenta. Te recomendamos activar la
            verificación en dos pasos.
          </li>
          <li>
            El administrador de un hogar decide a quién invita y con qué rol; las personas invitadas ven la información
            del hogar según ese rol.
          </li>
          <li>Avísanos de inmediato a {R.correoSoporte} si crees que alguien entró a tu cuenta.</li>
        </Lista>
      </Seccion>

      <Seccion n={3} titulo="Uso permitido">
        <p>No puedes usar My House para:</p>
        <Lista>
          <li>Actividades ilegales, lavado de activos o para ocultar información a las autoridades.</li>
          <li>Registrar datos de otras personas sin estar autorizado.</li>
          <li>Intentar acceder a información de otros hogares, vulnerar la seguridad o sobrecargar el servicio.</li>
          <li>Copiar, revender o usar el servicio de forma automatizada sin nuestra autorización.</li>
        </Lista>
        <p>Si incumples estas reglas podemos suspender o cerrar la cuenta, avisándote cuando sea posible.</p>
      </Seccion>

      <Seccion n={4} titulo="Tus datos">
        <p>
          La información que registras es tuya. Nos das permiso para guardarla y procesarla solo para prestarte el
          servicio, como explica la{" "}
          <Link href="/privacidad" className={enlace}>
            política de tratamiento de datos
          </Link>
          . Puedes pedir una copia o que la borremos.
        </p>
      </Seccion>

      <Seccion n={5} titulo="Planes, pagos y cancelación">
        <Lista>
          <li>
            Hay un plan gratuito y planes pagos. Los precios publicados incluyen IVA. Los límites de cada plan se muestran
            en Configuración → Plan.
          </li>
          <li>
            Los pagos se hacen a través de Wompi por el periodo que elijas (mensual o anual). Antes de que termine el
            periodo te enviamos un cobro para renovarlo; si no se paga, después de un periodo de gracia el hogar pasa al
            plan gratuito sin perder la información.
          </li>
          <li>Puedes pedir que no se renueve en cualquier momento; conservas el plan hasta el fin del periodo pagado.</li>
          <li>
            <strong>Derecho de retracto:</strong> puedes retractarte de la compra dentro de los 5 días hábiles siguientes
            al pago (artículo 47 de la Ley 1480 de 2011) escribiendo a {R.correoSoporte}. Devolvemos el dinero en un plazo
            máximo de 30 días calendario.
          </li>
          <li>
            Si cambian los precios, te avisaremos con al menos 30 días de anticipación; el cambio aplica desde la
            siguiente renovación.
          </li>
          <li>La prueba gratuita de un plan pago se ofrece una sola vez por hogar.</li>
        </Lista>
      </Seccion>

      <Seccion n={6} titulo="Disponibilidad">
        <p>
          Trabajamos para que My House esté disponible siempre, pero puede haber interrupciones por mantenimiento o
          fallas de proveedores. Podemos cambiar o retirar funciones;
          si retiramos una función pagada de forma sustancial, te avisaremos con anticipación.
        </p>
      </Seccion>

      <Seccion n={7} titulo="Responsabilidad">
        <p>
          My House se ofrece para ayudarte a organizar tus finanzas. En la medida en que lo permite la ley, no
          respondemos por decisiones financieras o tributarias tomadas con base en los cálculos de la app, ni por
          sanciones derivadas de declaraciones presentadas con información incompleta o errada. Nada de esto limita los
          derechos que te da el Estatuto del Consumidor (Ley 1480 de 2011).
        </p>
      </Seccion>

      <Seccion n={8} titulo="Propiedad intelectual">
        <p>
          La marca My House, el diseño y el software son de {R.nombre}. Te damos una licencia personal, no exclusiva e
          intransferible para usar la app mientras tengas cuenta.
        </p>
      </Seccion>

      <Seccion n={9} titulo="Cierre de la cuenta">
        <p>
          Puedes dejar de usar My House cuando quieras y pedir que borremos tu cuenta escribiendo a {R.correoDatos}. El
          borrado sigue lo descrito en la política de tratamiento de datos.
        </p>
      </Seccion>

      <Seccion n={10} titulo="Cambios a estos términos">
        <p>
          Si cambiamos estos términos de forma sustancial te avisaremos por correo o en la app antes de que apliquen y te
          pediremos aceptarlos de nuevo para seguir usando el servicio.
        </p>
      </Seccion>

      <Seccion n={11} titulo="Ley aplicable y contacto">
        <p>
          Estos términos se rigen por las leyes de la República de Colombia. Si tienes un problema, escríbenos primero a{" "}
          {R.correoSoporte}; también puedes acudir a la Superintendencia de Industria y Comercio. Teléfono: {R.telefono}.
        </p>
      </Seccion>
    </>
  );
}
