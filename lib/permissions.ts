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
    permissions: [
      'dashboard:view',
      'ventas:view', 'ventas:create', 'ventas:edit', 'ventas:payments',
      'cotizaciones:view', 'cotizaciones:create', 'cotizaciones:edit', 'cotizaciones:delete',
      'clientes:view', 'clientes:create', 'clientes:edit',
      'destinos:view',
      'temporadas:view',
    ],
    isDefault: true,
  },
  {
    name: 'Contador',
    // Cobra (registra abonos) pero no modifica ni elimina ventas
    permissions: [
      'dashboard:view',
      'bancos:view', 'bancos:create', 'bancos:edit', 'bancos:delete',
      'ventas:view', 'ventas:payments',
    ],
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

// ─── Permisos por accion ─────────────────────────────────────────────────────
// Formato guardado en Role.permissions:
//   "ventas"         -> formato anterior: acceso COMPLETO al apartado (compatibilidad)
//   "ventas:view"    -> ver
//   "ventas:create" / "ventas:edit" / "ventas:delete" / "ventas:payments"
// En la sesion se resuelve a: "ventas" (= puede ver) + "ventas:<accion>" por cada accion.
// Las comprobaciones de "ver" siguen usando el nombre del apartado ("ventas").

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'payments'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  payments: 'Pagos',
};

/** Acciones que aplican a cada apartado. */
export const MODULE_ACTIONS: Record<ModulePermission, PermissionAction[]> = {
  dashboard: ['view'],
  clientes: ['view', 'create', 'edit', 'delete'],
  destinos: ['view', 'create', 'edit', 'delete'],
  temporadas: ['view', 'create', 'edit', 'delete'],
  ventas: ['view', 'create', 'edit', 'delete', 'payments'],
  cotizaciones: ['view', 'create', 'edit', 'delete'],
  proveedores: ['view', 'create', 'edit', 'delete', 'payments'],
  bancos: ['view', 'create', 'edit', 'delete'],
  configuracion: ['view', 'edit'],
  usuarios: ['view', 'create', 'edit', 'delete'],
};

/** Que significa "Pagos" en cada apartado (para la pantalla de roles). */
export const PAYMENTS_LABEL: Partial<Record<ModulePermission, string>> = {
  ventas: 'Registrar abonos de clientes',
  proveedores: 'Registrar pagos a proveedores',
};

/** Lo guardado en el rol -> conjunto efectivo para la sesion. */
export function resolvePermissionList(stored: unknown): string[] {
  const result = new Set<string>();
  if (!Array.isArray(stored)) return [];
  for (const entry of stored) {
    if (typeof entry !== 'string') continue;
    const [module, action] = entry.split(':') as [ModulePermission, PermissionAction | undefined];
    const actions = MODULE_ACTIONS[module];
    if (!actions) {
      result.add(entry); // modulos fuera del catalogo (p. ej. 'landing') se respetan tal cual
      continue;
    }
    result.add(module); // cualquier accion implica poder ver
    if (!action) {
      // Formato anterior: el apartado completo
      actions.filter((a) => a !== 'view').forEach((a) => result.add(`${module}:${a}`));
    } else if (action !== 'view' && actions.includes(action)) {
      result.add(`${module}:${action}`);
    }
  }
  return [...result];
}

/** Conjunto efectivo -> lista a guardar (formato nuevo, con "ver" explicito). */
export function toStoredPermissions(effective: string[]): string[] {
  const stored: string[] = [];
  for (const module of ALL_MODULES) {
    if (!effective.includes(module)) continue;
    stored.push(`${module}:view`);
    for (const action of MODULE_ACTIONS[module]) {
      if (action !== 'view' && effective.includes(`${module}:${action}`)) stored.push(`${module}:${action}`);
    }
  }
  return stored;
}

/** ¿El conjunto efectivo permite la accion? */
export function can(effective: string[] | undefined, module: string, action: PermissionAction = 'view'): boolean {
  if (!effective) return false;
  return action === 'view' ? effective.includes(module) : effective.includes(`${module}:${action}`);
}

/**
 * Limpia lo que llega del formulario de roles: descarta valores desconocidos,
 * agrega "ver" cuando hay otra accion y devuelve el formato nuevo.
 */
export function sanitizeRolePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const valid = input.filter((entry): entry is string => {
    if (typeof entry !== 'string') return false;
    const [module, action] = entry.split(':') as [ModulePermission, PermissionAction | undefined];
    const actions = MODULE_ACTIONS[module];
    return !!actions && (!action || actions.includes(action));
  });
  return toStoredPermissions(resolvePermissionList(valid));
}
