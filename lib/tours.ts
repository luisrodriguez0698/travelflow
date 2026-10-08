// Guias paso a paso (driver.js). Cada paso apunta a un elemento marcado con
// data-tour="<element>". Si el elemento no existe o no esta visible (sin
// permiso, version movil, lista vacia) el paso se omite automaticamente.
// Los pasos sin `element` se muestran centrados.

export interface TourStep {
  element?: string;
  title: string;
  description: string;
}

export interface TourDef {
  id: string;
  title: string;
  /** Pagina donde corre el tour. */
  path: string;
  /** Permiso necesario para ver la pagina (sin permiso, no se ofrece). */
  module?: string;
  steps: TourStep[];
}

const historyTip =
  'El círculo con iniciales es <b>quién lo creó</b>. Haz clic en él para ver el <b>historial</b>: quién lo modificó, qué cambió y cuándo.';

export const GENERAL_TOUR: TourDef = {
  id: 'general',
  title: 'Recorrido general del sistema',
  path: '/dashboard',
  steps: [
    {
      title: '¡Bienvenido a TravelFlow! ✈️',
      description:
        'Te mostramos en un minuto dónde está cada cosa. Puedes salir cuando quieras con <b>Esc</b> y repetirlo desde el botón <b>?</b> de arriba.',
    },
    {
      element: 'nav-group-Comercial',
      title: 'Comercial',
      description: 'Tu día a día: <b>clientes</b>, <b>ventas</b>, <b>metas</b>, <b>cotizaciones</b> y <b>plantillas</b> de paquetes.',
    },
    {
      element: 'nav-group-Catálogo',
      title: 'Catálogo',
      description: 'Lo que vendes: <b>destinos</b>, <b>hoteles</b>, <b>servicios</b> (vuelos, tours, transporte) y <b>temporadas</b>. Se captura una vez y se reutiliza.',
    },
    {
      element: 'nav-group-Finanzas',
      title: 'Finanzas',
      description: '<b>Proveedores</b>, lo que les <b>debes</b> por cada venta y tus <b>cuentas bancarias</b> con sus movimientos.',
    },
    {
      element: 'nav-group-Administración',
      title: 'Administración',
      description: '<b>Usuarios</b> y permisos, la <b>bitácora</b> de cambios y la <b>configuración</b> de tu agencia.',
    },
    { element: 'dash-metrics', title: 'Indicadores', description: 'Ventas del mes, clientes activos y pagos por cobrar de un vistazo.' },
    {
      element: 'dash-chart',
      title: 'Ventas por mes',
      description: 'Lo que vendiste y tu <b>ganancia</b> mes a mes. Pasa el mouse por una barra para ver el detalle, cambia entre <b>6 y 12 meses</b> o ábrelo como <b>tabla</b>.',
    },
    {
      element: 'dash-activity',
      title: 'Pagos y ventas recientes',
      description: 'Abonos <b>por vencer</b> o <b>vencidos</b> y las últimas ventas registradas.',
    },
    { element: 'navbar-calendar', title: 'Calendario', description: 'Salidas de viajes y fechas de pago en vista de calendario.' },
    { element: 'navbar-trips', title: 'Viajes en curso', description: 'Quién está viajando hoy y quién sale pronto.' },
    { element: 'navbar-notifications', title: 'Notificaciones', description: 'Avisos de pagos a proveedores y fechas límite.' },
    { element: 'navbar-theme', title: 'Modo claro / oscuro', description: 'Cambia el tema a tu gusto.' },
    { element: 'navbar-user', title: 'Tu cuenta', description: 'Entra a <b>Mi perfil</b> para cambiar tu nombre, correo o contraseña.' },
    {
      element: 'navbar-help',
      title: '¿Se te olvidó algo?',
      description: 'Aquí encuentras la <b>guía de cada apartado</b> paso a paso, cuando la necesites.',
    },
  ],
};

export const SECTION_TOURS: TourDef[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/dashboard',
    module: 'dashboard',
    steps: [
      { element: 'dash-metrics', title: 'Indicadores del mes', description: 'Ventas, clientes activos y pagos pendientes, actualizados al momento.' },
      { element: 'dash-chart', title: 'Tendencia', description: 'Compara lo vendido y la ganancia de cada mes; el margen aparece al pasar el mouse.' },
      { element: 'dash-activity', title: 'Lo urgente', description: 'Revisa aquí cada mañana los abonos vencidos o por vencer para dar seguimiento a tus clientes.' },
    ],
  },
  {
    id: 'sales',
    title: 'Ventas',
    path: '/sales',
    module: 'ventas',
    steps: [
      { element: 'page-action', title: 'Registrar una venta', description: 'Crea una venta nueva: cliente, fechas, precio, forma de pago y servicios del paquete.' },
      { element: 'page-filters', title: 'Buscar', description: 'Encuentra una venta por <b>folio</b>. Arriba puedes filtrar por <b>rango de fechas</b> y <b>cliente</b>.' },
      {
        element: 'page-list',
        title: 'Tus ventas',
        description: `Con 👁 ves el detalle y registras abonos; con ✏️ la editas. ${historyTip}`,
      },
    ],
  },
  {
    id: 'sales-new',
    title: 'Crear una venta',
    path: '/sales/new',
    module: 'ventas',
    steps: [
      { element: 'form-client', title: '1. Cliente y fechas', description: 'Elige al cliente (o créalo con <b>+</b>) y las fechas de salida y regreso.' },
      {
        element: 'form-services',
        title: '2. Servicios del paquete',
        description: 'Agrega <b>habitaciones</b>, <b>vuelos</b>, <b>tours</b> y <b>transporte</b>. Puedes tomarlos del catálogo para no capturar todo; el costo neto se suma solo.',
      },
      {
        element: 'form-pricing',
        title: '3. Precio y forma de pago',
        description: 'Escribe el precio de venta y verás tu ganancia. Con <b>Crédito</b> defines anticipo, número de pagos y frecuencia, con vista previa del plan.',
      },
      {
        element: 'form-actions',
        title: '4. Plantillas y guardar',
        description: '<b>Usar plantilla</b> carga un paquete armado; <b>Guardar como plantilla</b> guarda este para la próxima. Al final, <b>Crear venta</b>.',
      },
    ],
  },
  {
    id: 'quotations',
    title: 'Cotizaciones',
    path: '/quotations',
    module: 'cotizaciones',
    steps: [
      { element: 'page-action', title: 'Nueva cotización', description: 'Arma una propuesta para el cliente y descárgala en PDF.' },
      { element: 'page-filters', title: 'Buscar', description: 'Busca por folio o filtra por fechas, cliente, destino o proveedor.' },
      {
        element: 'page-list',
        title: 'Convertir en venta',
        description: `Cuando el cliente acepte, usa el botón 🛒 para <b>convertirla en venta</b> sin volver a capturar nada. ${historyTip}`,
      },
    ],
  },
  {
    id: 'quotations-new',
    title: 'Crear una cotización',
    path: '/quotations/new',
    module: 'cotizaciones',
    steps: [
      { element: 'form-client', title: '1. Cliente y fechas', description: 'Elige al cliente y las fechas tentativas del viaje.' },
      { element: 'form-services', title: '2. Servicios', description: 'Agrega lo que incluye el paquete; puedes tomarlo del catálogo.' },
      { element: 'form-pricing', title: '3. Precio', description: 'Precio que le ofreces al cliente y tu ganancia estimada.' },
      { element: 'form-actions', title: '4. Plantillas y guardar', description: 'Carga o guarda plantillas y crea la cotización. Abajo puedes poner su <b>fecha de vigencia</b>.' },
    ],
  },
  {
    id: 'clients',
    title: 'Clientes',
    path: '/clients',
    module: 'clientes',
    steps: [
      { element: 'page-action', title: 'Nuevo cliente', description: 'Registra nombre, teléfono, correo y documentos (INE, pasaporte, CURP).' },
      { element: 'page-filters', title: 'Buscar', description: 'Por nombre, correo o teléfono.' },
      { element: 'page-list', title: 'Tus clientes', description: `Entra a un cliente para ver todas sus ventas. ${historyTip}` },
    ],
  },
  {
    id: 'destinations',
    title: 'Destinos',
    path: '/destinations',
    module: 'destinos',
    steps: [
      { element: 'page-action', title: 'Nuevo destino', description: 'Ej. Cancún, Europa. Los hoteles se organizan por destino.' },
      { element: 'page-filters', title: 'Buscar', description: 'Encuentra un destino por nombre.' },
      { element: 'page-list', title: 'Destinos', description: historyTip },
    ],
  },
  {
    id: 'hotels',
    title: 'Hoteles',
    path: '/hotels',
    module: 'destinos',
    steps: [
      { element: 'page-action', title: 'Nuevo hotel', description: 'Captura plan, tipo de habitación, check-in/out, qué incluye y fotos. Luego lo eliges al vender sin volver a escribirlo.' },
      { element: 'page-filters', title: 'Buscar', description: 'Por nombre o plan.' },
      { element: 'page-list', title: 'Hoteles', description: `Desde aquí también descargas el flyer del hotel. ${historyTip}` },
    ],
  },
  {
    id: 'services',
    title: 'Servicios (vuelos, tours, transporte)',
    path: '/services',
    module: 'destinos',
    steps: [
      { element: 'page-tabs', title: 'Tipos de servicio', description: 'Cambia entre <b>Vuelos</b>, <b>Tours</b> y <b>Transporte</b>.' },
      { element: 'page-action', title: 'Agregar al catálogo', description: 'Captura los datos fijos, el costo neto y el proveedor (opcional).' },
      {
        element: 'page-list',
        title: 'Usarlos al vender',
        description: 'En una venta o cotización, al agregar vuelo/tour/transporte elige <b>“Del catálogo”</b>: se llenan todos los datos y solo ajustas el costo.',
      },
    ],
  },
  {
    id: 'seasons',
    title: 'Temporadas',
    path: '/seasons',
    module: 'temporadas',
    steps: [
      { element: 'page-action', title: 'Nueva temporada', description: 'Ej. Semana Santa, Verano. Cada una tiene un color para identificarla.' },
      { element: 'page-list', title: 'Temporadas', description: 'Asígnalas a tus destinos para organizar las salidas.' },
    ],
  },
  {
    id: 'templates',
    title: 'Plantillas',
    path: '/templates',
    steps: [
      { element: 'page-action', title: 'Nueva plantilla', description: 'Un paquete armado (servicios, precio y notas) para reutilizar.' },
      {
        element: 'page-list',
        title: 'Usar una plantilla',
        description: 'Con <b>Crear venta</b> o <b>Crear cotización</b> se abre el formulario ya lleno; solo eliges cliente y fechas.',
      },
    ],
  },
  {
    id: 'suppliers',
    title: 'Proveedores',
    path: '/suppliers',
    module: 'proveedores',
    steps: [
      { element: 'page-action', title: 'Nuevo proveedor', description: 'Hoteles, aerolíneas, transportistas… con su tipo de servicio y contacto.' },
      { element: 'page-filters', title: 'Buscar', description: 'Por nombre, correo, teléfono o tipo.' },
      { element: 'page-list', title: 'Proveedores', description: historyTip },
    ],
  },
  {
    id: 'debts',
    title: 'Deudas a proveedores',
    path: '/suppliers/debts',
    module: 'proveedores',
    steps: [
      { element: 'page-summary', title: 'Resumen', description: 'Cuánto debes en total, cuánto has pagado y cuánto falta.' },
      {
        element: 'page-list',
        title: 'Por proveedor',
        description: 'Entra a un proveedor para ver la deuda <b>por venta</b> y registrar pagos desde tus cuentas bancarias.',
      },
    ],
  },
  {
    id: 'banks',
    title: 'Bancos',
    path: '/banks',
    module: 'bancos',
    steps: [
      { element: 'page-action', title: 'Nueva cuenta', description: 'Registra tus cuentas (débito, crédito, ahorro) con su saldo inicial.' },
      {
        element: 'page-summary',
        title: 'Saldo total',
        description: 'Entra a una cuenta para ver y registrar <b>ingresos</b>, <b>egresos</b> y <b>transferencias</b>. Los abonos de clientes llegan aquí solos.',
      },
    ],
  },
  {
    id: 'users',
    title: 'Usuarios y roles',
    path: '/users',
    module: 'usuarios',
    steps: [
      { element: 'page-action', title: 'Invitar', description: 'Envía una invitación por correo con el rol que tendrá.' },
      {
        element: 'page-tabs',
        title: 'Usuarios, roles e invitaciones',
        description: 'En <b>Usuarios</b> los editas, desactivas o eliminas. En <b>Roles</b> defines qué apartados ve cada quien. En <b>Invitaciones</b> reenvías las pendientes.',
      },
    ],
  },
  {
    id: 'audit',
    title: 'Bitácora',
    path: '/audit',
    module: 'usuarios',
    steps: [
      { element: 'page-filters', title: 'Filtros', description: 'Filtra por apartado, usuario o tipo de acción (crear, modificar, eliminar).' },
      { title: 'Línea de tiempo', description: 'Cada cambio muestra quién lo hizo, cuándo y el valor <b>anterior → nuevo</b>.' },
    ],
  },
  {
    id: 'settings',
    title: 'Configuración',
    path: '/settings',
    module: 'configuracion',
    steps: [
      { element: 'settings-agency', title: 'Datos de la agencia', description: 'Logo, contacto y políticas. Aparecen en los PDF de ventas y cotizaciones.' },
      { element: 'settings-app', title: 'App y notificaciones', description: 'Instala TravelFlow como app y activa los avisos de pagos.' },
      { element: 'settings-danger', title: 'Zona de peligro', description: 'Solo el propietario: restablecer datos o eliminar la agencia.' },
    ],
  },
];

export const ALL_TOURS = [GENERAL_TOUR, ...SECTION_TOURS];

/** Tour de la pagina actual. */
export function tourForPath(pathname: string): TourDef | undefined {
  return SECTION_TOURS.find((t) => t.path === pathname);
}
