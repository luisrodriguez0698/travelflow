// Categorias de los egresos que se registran a mano en Bancos (sin dependencias
// de servidor: se usa en API y en UI). Los pagos a proveedores, gastos fijos y
// comisiones ya tienen su propio origen y no usan esta categoria.

export const EXPENSE_CATEGORIES = {
  OFICINA: { label: 'Gastos de oficina', emoji: '🏢', isExpense: true },
  PUBLICIDAD: { label: 'Publicidad y diseño', emoji: '📣', isExpense: true },
  MANTENIMIENTO: { label: 'Mantenimiento y reparaciones', emoji: '🛠️', isExpense: true },
  PAPELERIA: { label: 'Papelería e insumos', emoji: '📎', isExpense: true },
  TRANSPORTE: { label: 'Transporte y viáticos', emoji: '🚗', isExpense: true },
  OTRO: { label: 'Otro gasto', emoji: '🧾', isExpense: true },
  // No son gasto del negocio: no restan en la utilidad neta
  RETIRO: { label: 'Retiro del dueño o socio', emoji: '👤', isExpense: false },
  NO_GASTO: { label: 'No es gasto (devolución, proveedor ya en costo…)', emoji: '↩️', isExpense: false },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const isExpenseCategory = (v: unknown): v is ExpenseCategory => typeof v === 'string' && v in EXPENSE_CATEGORIES;

/** Sin categoria (egresos anteriores) cuenta como "Otro gasto". */
export const categoryInfo = (v: string | null | undefined) => EXPENSE_CATEGORIES[isExpenseCategory(v) ? v : 'OTRO'];
