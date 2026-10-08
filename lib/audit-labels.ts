// Textos de la bitacora (sin dependencias de servidor: se usa en API y en UI)

export const AUDIT_ENTITIES: Record<string, { label: string; singular: string; gender: 'm' | 'f' }> = {
  sales: { label: 'Ventas', singular: 'venta', gender: 'f' },
  quotations: { label: 'Cotizaciones', singular: 'cotización', gender: 'f' },
  clients: { label: 'Clientes', singular: 'cliente', gender: 'm' },
  destinations: { label: 'Destinos', singular: 'destino', gender: 'm' },
  hotels: { label: 'Hoteles', singular: 'hotel', gender: 'm' },
  services: { label: 'Servicios', singular: 'servicio', gender: 'm' },
  seasons: { label: 'Temporadas', singular: 'temporada', gender: 'f' },
  templates: { label: 'Plantillas', singular: 'plantilla', gender: 'f' },
  suppliers: { label: 'Proveedores', singular: 'proveedor', gender: 'm' },
  supplier_payments: { label: 'Pagos a proveedores', singular: 'pago a proveedor', gender: 'm' },
  bank_accounts: { label: 'Bancos', singular: 'cuenta bancaria', gender: 'f' },
  bank_transactions: { label: 'Movimientos bancarios', singular: 'movimiento', gender: 'm' },
  sales_goals: { label: 'Metas', singular: 'meta', gender: 'f' },
  users: { label: 'Usuarios', singular: 'usuario', gender: 'm' },
  roles: { label: 'Roles', singular: 'rol', gender: 'm' },
  invitations: { label: 'Invitaciones', singular: 'invitación', gender: 'f' },
  account: { label: 'Cuenta', singular: 'información de la agencia', gender: 'f' },
};

/** Permiso necesario para ver el historial de cada apartado (null = cualquiera). */
export const AUDIT_ENTITY_PERMISSION: Record<string, string | null> = {
  sales: 'ventas',
  bookings: 'ventas',
  quotations: 'cotizaciones',
  sales_goals: 'ventas',
  clients: 'clientes',
  destinations: 'destinos',
  hotels: 'destinos',
  services: 'destinos',
  seasons: 'temporadas',
  templates: null,
  suppliers: 'proveedores',
  supplier_payments: 'proveedores',
  bank_accounts: 'bancos',
  bank_transactions: 'bancos',
  users: 'usuarios',
  roles: 'usuarios',
  invitations: 'usuarios',
  account: 'usuarios',
};

/** Una venta pudo empezar como cotizacion; los registros antiguos usan "bookings". */
export function auditEntityGroup(entity: string): string[] {
  if (entity === 'sales' || entity === 'quotations' || entity === 'bookings') {
    return ['sales', 'quotations', 'bookings'];
  }
  return [entity];
}

export function actionTitle(action: string, entity: string): string {
  const e = AUDIT_ENTITIES[entity === 'bookings' ? 'sales' : entity];
  const noun = e ? `${e.gender === 'f' ? 'la' : 'el'} ${e.singular}` : 'el registro';
  if (action === 'CREATE') return `Creó ${noun}`;
  if (action === 'DELETE') return `Eliminó ${noun}`;
  return `Modificó ${noun}`;
}

export const FIELD_LABELS: Record<string, string> = {
  // Comunes
  name: 'Nombre', description: 'Descripción', notes: 'Notas', email: 'Correo', phone: 'Teléfono',
  isActive: 'Activo', deletedAt: 'Eliminado', isInternational: 'Internacional', cost: 'Costo neto',
  supplierId: 'Proveedor', destinationId: 'Destino', hotelId: 'Hotel', seasonId: 'Temporada',
  clientId: 'Cliente', roleId: 'Rol', bankAccountId: 'Cuenta bancaria',
  // Clientes
  fullName: 'Nombre completo', ine: 'INE', passport: 'Pasaporte', curp: 'CURP', birthDate: 'Fecha de nacimiento',
  // Ventas / cotizaciones
  type: 'Tipo', totalPrice: 'Precio total', netCost: 'Costo neto', paymentType: 'Tipo de pago',
  downPayment: 'Anticipo', numberOfPayments: 'Número de pagos', saleDate: 'Fecha de venta', status: 'Estado',
  departureDate: 'Fecha de salida', returnDate: 'Fecha de regreso', expirationDate: 'Vigencia',
  priceAdult: 'Precio por adulto', priceChild: 'Precio por menor', numAdults: 'Adultos', numChildren: 'Menores',
  pricePerNight: 'Precio por noche', numNights: 'Noches', freeChildren: 'Menores gratis',
  reservationNumber: 'No. de reservación', paymentFrequency: 'Frecuencia de pagos', supplierDeadline: 'Fecha límite proveedor',
  // Pagos
  dueDate: 'Vencimiento', amount: 'Monto', paidDate: 'Fecha de pago', paidAmount: 'Monto pagado',
  // Destinos / hoteles / temporadas
  color: 'Color', stars: 'Estrellas', diamonds: 'Diamantes', plan: 'Plan', roomType: 'Tipo de habitación',
  checkIn: 'Check-in', checkOut: 'Check-out', checkInNote: 'Nota check-in', checkOutNote: 'Nota check-out',
  idRequirement: 'Identificación requerida', includes: 'Incluye', notIncludes: 'No incluye', images: 'Imágenes',
  webDescription: 'Descripción web', packagePrice: 'Precio de paquete', packageCurrency: 'Moneda', showInWeb: 'Visible en web',
  // Proveedores / bancos
  serviceType: 'Tipo de servicio', bankName: 'Banco', accountNumber: 'Número de cuenta', accountType: 'Tipo de cuenta',
  referenceName: 'Nombre de referencia', initialBalance: 'Saldo inicial',
  // Servicios
  origin: 'Origen', destination: 'Destino', direction: 'Dirección', departureTime: 'Hora de salida',
  arrivalTime: 'Hora de llegada', returnDepartureTime: 'Salida de regreso', returnArrivalTime: 'Llegada de regreso',
  airline: 'Aerolínea', flightNumber: 'No. de vuelo', flightClass: 'Clase', returnFlightNumber: 'Vuelo de regreso',
  transportType: 'Tipo de unidad',
  // Plantillas / roles / usuarios
  items: 'Servicios', permissions: 'Permisos', isDefault: 'Predeterminado', password: 'Contraseña',
  // Restablecimiento de cuenta
  bookings: 'Ventas y cotizaciones', supplierPayments: 'Pagos a proveedores', bankAccounts: 'Cuentas bancarias',
  bankTransactions: 'Movimientos bancarios', clients: 'Clientes', goals: 'Metas', audit: 'Registros de bitácora',
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  type: { SALE: 'Venta', QUOTATION: 'Cotización', FLIGHT: 'Vuelo', TOUR: 'Tour', TRANSFER: 'Transporte' },
  status: {
    ACTIVE: 'Activa', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
    PENDING: 'Pendiente', PAID: 'Pagado', OVERDUE: 'Vencido', PARTIAL: 'Parcial',
  },
  paymentType: { CASH: 'Contado', CREDIT: 'Crédito' },
  paymentFrequency: { QUINCENAL: 'Quincenal', MENSUAL: 'Mensual' },
  direction: { IDA: 'Ida', REGRESO: 'Regreso', IDA_Y_VUELTA: 'Ida y vuelta' },
  flightClass: { ECONOMICA: 'Económica', BUSINESS: 'Business', PRIMERA: 'Primera' },
};

const MONEY_FIELDS = new Set([
  'totalPrice', 'netCost', 'downPayment', 'priceAdult', 'priceChild', 'pricePerNight', 'cost',
  'amount', 'paidAmount', 'initialBalance', 'currentBalance', 'packagePrice',
]);
const DATE_FIELDS = new Set([
  'saleDate', 'departureDate', 'returnDate', 'expirationDate', 'dueDate', 'paidDate', 'birthDate', 'supplierDeadline',
]);

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  // camelCase -> "Camel case"
  const words = field.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'deletedAt') return 'Sí';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (MONEY_FIELDS.has(field) && typeof value === 'number') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  }
  if (typeof value === 'string') {
    if (VALUE_LABELS[field]?.[value]) return VALUE_LABELS[field][value];
    if (DATE_FIELDS.has(field) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return value;
  }
  if (typeof value === 'number') return value.toLocaleString('es-MX');
  return String(value);
}
