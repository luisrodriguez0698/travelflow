import { Prisma, PrismaClient } from '@prisma/client';

// Bitacora automatica: cada create/update/delete de los modelos de abajo genera
// un AuditLog con quien lo hizo y que cambio (valor anterior -> nuevo).
// Se arma aqui (y no en cada API) para que ningun apartado se quede sin registro.

type AuditRecord = Record<string, any>;

interface TrackConfig {
  /** Nombre de la seccion en la bitacora (AuditLog.entity). */
  entity: (r: AuditRecord) => string;
  /** Registro al que pertenece el historial (por defecto, el propio id). */
  entityId?: (r: AuditRecord) => string;
  /** Texto de contexto, p. ej. "Pago #3" para un abono dentro de una venta. */
  context?: (r: AuditRecord) => string;
  /** Campos que no se registran (ruido o calculados). */
  ignore?: string[];
  /** Campos sensibles: solo se registra que cambiaron, nunca su valor. */
  mask?: string[];
}

const ALWAYS_IGNORE = ['id', 'tenantId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];

const TRACKED: Record<string, TrackConfig> = {
  Client: { entity: () => 'clients' },
  Booking: { entity: (r) => (r.type === 'QUOTATION' ? 'quotations' : 'sales'), ignore: ['packageId', 'departureId'] },
  PaymentPlan: {
    entity: () => 'sales',
    entityId: (r) => r.bookingId,
    context: (r) => `Pago #${r.paymentNumber}`,
    ignore: ['bookingId', 'paymentNumber', 'lastReminderSentAt'],
  },
  Destination: { entity: () => 'destinations' },
  Hotel: { entity: () => 'hotels' },
  Season: { entity: () => 'seasons' },
  Supplier: { entity: () => 'suppliers' },
  // El saldo cambia con cada movimiento, que ya tiene su propio registro
  BankAccount: { entity: () => 'bank_accounts', ignore: ['currentBalance'], mask: ['accountNumber'] },
  ServiceCatalog: { entity: () => 'services' },
  PackageTemplate: { entity: () => 'templates' },
  Role: { entity: () => 'roles' },
  User: {
    entity: () => 'users',
    ignore: ['passwordResetToken', 'passwordResetExpires', 'role'],
    mask: ['password'],
  },
};

const MASKED_VALUE = '••••';
const MAX_TEXT = 300;

// Campos escalares por modelo (sin relaciones), tomados del esquema de Prisma
const scalarFields: Record<string, { name: string; type: string }[]> = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    m.fields.filter((f) => f.kind !== 'object').map((f) => ({ name: f.name, type: f.type })),
  ])
);

function normalize(value: unknown, type: string): unknown {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  if (type === 'Json') {
    return Array.isArray(value) ? `${value.length} elemento${value.length !== 1 ? 's' : ''}` : 'actualizado';
  }
  if (Array.isArray(value)) return value.join(', ').slice(0, MAX_TEXT) || null;
  if (typeof value === 'string' && value.length > MAX_TEXT) return value.slice(0, MAX_TEXT) + '…';
  return value;
}

function changedFields(model: string, before: AuditRecord | null, after: AuditRecord | null) {
  const cfg = TRACKED[model];
  const skip = new Set([...ALWAYS_IGNORE, ...(cfg.ignore || [])]);
  const mask = new Set(cfg.mask || []);
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const { name, type } of scalarFields[model] || []) {
    if (skip.has(name)) continue;
    const oldV = before ? normalize(before[name], type) : null;
    const newV = after ? normalize(after[name], type) : null;
    if (JSON.stringify(oldV) === JSON.stringify(newV)) continue;
    // En altas/bajas solo interesan los campos con valor
    if (!before && newV === null) continue;
    if (!after && oldV === null) continue;
    changes[name] = mask.has(name)
      ? { old: before ? MASKED_VALUE : null, new: after ? MASKED_VALUE : null }
      : { old: oldV, new: newV };
  }
  return changes;
}

async function currentUser() {
  try {
    // Import dinamico: get-tenant -> auth-options -> prisma (evita import circular)
    const { getSessionUser } = await import('./get-tenant');
    return await getSessionUser();
  } catch {
    // Fuera de una peticion (scripts, seed) no hay sesion
    return null;
  }
}

async function writeLog(
  base: PrismaClient,
  model: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  before: AuditRecord | null,
  after: AuditRecord | null
) {
  const record = after || before;
  if (!record) return;
  const cfg = TRACKED[model];

  let changes: Record<string, unknown> = changedFields(model, before, after);
  if (action === 'UPDATE' && Object.keys(changes).length === 0) return;

  // Borrado logico (deletedAt) se muestra como eliminacion
  if (action === 'UPDATE' && before && after && !before.deletedAt && after.deletedAt) action = 'DELETE';
  if (cfg.context) changes = { _context: cfg.context(record), ...changes };

  const user = await currentUser();
  if (!user) return; // altas sin sesion (registro, aceptar invitacion)

  try {
    await base.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        userName: user.name,
        action,
        entity: cfg.entity(record),
        entityId: cfg.entityId ? cfg.entityId(record) : record.id,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

const delegate = (base: PrismaClient, model: string) =>
  (base as any)[model.charAt(0).toLowerCase() + model.slice(1)];

export function withAudit(base: PrismaClient) {
  return base.$extends({
    name: 'audit-log',
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (TRACKED[model] && (result as any)?.id) {
            const after = (await delegate(base, model).findUnique({ where: { id: (result as any).id } })) || result;
            await writeLog(base, model, 'CREATE', null, after);
          }
          return result;
        },
        async update({ model, args, query }) {
          if (!TRACKED[model]) return query(args);
          const before = await delegate(base, model).findFirst({ where: args.where });
          const result = await query(args);
          if (before) {
            const after = (await delegate(base, model).findUnique({ where: { id: before.id } })) || result;
            await writeLog(base, model, 'UPDATE', before, after);
          }
          return result;
        },
        async updateMany({ model, args, query }) {
          if (!TRACKED[model]) return query(args);
          const befores: AuditRecord[] = await delegate(base, model).findMany({ where: args.where, take: 100 });
          const result = await query(args);
          if (befores.length) {
            const afters: AuditRecord[] = await delegate(base, model).findMany({
              where: { id: { in: befores.map((b) => b.id) } },
            });
            const byId = new Map(afters.map((a) => [a.id, a]));
            for (const before of befores) {
              const after = byId.get(before.id);
              if (after) await writeLog(base, model, 'UPDATE', before, after);
            }
          }
          return result;
        },
        async delete({ model, args, query }) {
          if (!TRACKED[model]) return query(args);
          const before = await delegate(base, model).findFirst({ where: args.where });
          const result = await query(args);
          if (before) await writeLog(base, model, 'DELETE', before, null);
          return result;
        },
        async deleteMany({ model, args, query }) {
          // PaymentPlan.deleteMany ocurre al editar/eliminar una venta: ruido, no se registra
          if (!TRACKED[model] || model === 'PaymentPlan') return query(args);
          const befores: AuditRecord[] = await delegate(base, model).findMany({ where: args.where, take: 100 });
          const result = await query(args);
          for (const before of befores) await writeLog(base, model, 'DELETE', before, null);
          return result;
        },
      },
    },
  });
}
