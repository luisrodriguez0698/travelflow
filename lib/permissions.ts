export const ALL_MODULES = [
  'dashboard',
  'clientes',
  'destinos',
  'temporadas',
  'ventas',
  'cotizaciones',
  'proveedores',
  'bancos',
  'configuracion',
  'usuarios',
] as const;

export type ModulePermission = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<ModulePermission, string> = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  destinos: 'Destinos',
  temporadas: 'Temporadas',
  ventas: 'Ventas',
  cotizaciones: 'Cotizaciones',
  proveedores: 'Proveedores',
  bancos: 'Bancos',
  configuracion: 'Configuración',
  usuarios: 'Usuarios',
};

export const ROUTE_TO_MODULE: Record<string, ModulePermission> = {
  '/dashboard': 'dashboard',
  '/clients': 'clientes',
  '/destinations': 'destinos',
  '/hotels': 'destinos',
  '/services': 'destinos',
  '/packages': 'destinos',
  '/seasons': 'temporadas',
  '/sales': 'ventas',
  '/sales/goals': 'ventas',
  '/calendar': 'ventas',
  '/quotations': 'cotizaciones',
  '/suppliers': 'proveedores',
  '/suppliers/debts': 'proveedores',
  '/banks': 'bancos',
  '/settings': 'configuracion',
  '/users': 'usuarios',
  '/audit': 'usuarios',
};

export const DEFAULT_ROLES = [
  {
    name: 'Admin',
    permissions: [...ALL_MODULES],
    isDefault: true,
  },
  {
    name: 'Agente',
    permissions: ['dashboard', 'ventas', 'cotizaciones', 'clientes', 'destinos', 'temporadas'],
    isDefault: true,
  },
  {
    name: 'Contador',
    permissions: ['dashboard', 'bancos', 'ventas'],
    isDefault: true,
  },
];

/** El rol Admin creado con la agencia es el super usuario: no se edita ni se elimina. */
export const PROTECTED_ROLE_NAME = 'Admin';

export function isProtectedRole(role: { name: string; isDefault: boolean }): boolean {
  return role.isDefault && role.name === PROTECTED_ROLE_NAME;
}

/** Modulo requerido por una pagina (la ruta mas especifica gana); undefined = libre. */
export function moduleForPath(pathname: string): ModulePermission | undefined {
  let best: string | undefined;
  for (const route of Object.keys(ROUTE_TO_MODULE)) {
    if ((pathname === route || pathname.startsWith(route + '/')) && (!best || route.length > best.length)) {
      best = route;
    }
  }
  return best ? ROUTE_TO_MODULE[best] : undefined;
}

/** Primera pagina a la que el usuario si tiene acceso (para redirigirlo). */
export function firstAllowedPath(permissions: string[]): string {
  const route = Object.entries(ROUTE_TO_MODULE).find(([, module]) => permissions.includes(module));
  return route ? route[0] : '/profile';
}
