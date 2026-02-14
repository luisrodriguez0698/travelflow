export const ALL_MODULES = [
  'dashboard',
  'clientes',
  'paquetes',
  'temporadas',
  'ventas',
  'proveedores',
  'bancos',
  'configuracion',
  'usuarios',
] as const;

export type ModulePermission = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<ModulePermission, string> = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  paquetes: 'Paquetes',
  temporadas: 'Temporadas',
  ventas: 'Ventas',
  proveedores: 'Proveedores',
  bancos: 'Bancos',
  configuracion: 'Configuración',
  usuarios: 'Usuarios',
};

export const ROUTE_TO_MODULE: Record<string, ModulePermission> = {
  '/dashboard': 'dashboard',
  '/clients': 'clientes',
  '/packages': 'paquetes',
  '/seasons': 'temporadas',
  '/sales': 'ventas',
  '/suppliers': 'proveedores',
  '/banks': 'bancos',
  '/settings': 'configuracion',
  '/users': 'usuarios',
};

export const DEFAULT_ROLES = [
  {
    name: 'Admin',
    permissions: [...ALL_MODULES],
    isDefault: true,
  },
  {
    name: 'Agente',
    permissions: ['dashboard', 'ventas', 'clientes', 'paquetes', 'temporadas'],
    isDefault: true,
  },
  {
    name: 'Contador',
    permissions: ['dashboard', 'bancos', 'ventas'],
    isDefault: true,
  },
];
