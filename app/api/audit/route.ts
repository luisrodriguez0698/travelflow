import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { AUDIT_ENTITY_PERMISSION, auditEntityGroup } from '@/lib/audit-labels';

export const dynamic = 'force-dynamic';

type Change = { old?: unknown; new?: unknown };

// Campos que guardan un id: se muestran con el nombre del registro
const FK_RESOLVERS: Record<string, (ids: string[], tenantId: string) => Promise<{ id: string; label: string }[]>> = {
  clientId: (ids, tenantId) =>
    prisma.client.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, fullName: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.fullName }))),
  destinationId: (ids, tenantId) =>
    prisma.destination.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name }))),
  hotelId: (ids, tenantId) =>
    prisma.hotel.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name }))),
  supplierId: (ids, tenantId) =>
    prisma.supplier.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name }))),
  seasonId: (ids, tenantId) =>
    prisma.season.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name }))),
  roleId: (ids, tenantId) =>
    prisma.role.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name }))),
  bankAccountId: (ids, tenantId) =>
    prisma.bankAccount.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, referenceName: true, bankName: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: `${x.referenceName} (${x.bankName})` }))),
};

// Nombre del registro (para la bitacora general)
const RECORD_LABELS: Record<string, (ids: string[], tenantId: string) => Promise<{ id: string; label: string }[]>> = {
  clients: FK_RESOLVERS.clientId,
  destinations: FK_RESOLVERS.destinationId,
  hotels: FK_RESOLVERS.hotelId,
  suppliers: FK_RESOLVERS.supplierId,
  seasons: FK_RESOLVERS.seasonId,
  roles: FK_RESOLVERS.roleId,
  bank_accounts: FK_RESOLVERS.bankAccountId,
  sales: (ids, tenantId) =>
    prisma.booking.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, client: { select: { fullName: true } } } })
      .then((r) => r.map((x) => ({ id: x.id, label: `${x.id.slice(-8).toUpperCase()} · ${x.client.fullName}` }))),
  services: (ids, tenantId) =>
    prisma.serviceCatalog.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name }))),
  templates: (ids, tenantId) =>
    prisma.packageTemplate.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name }))),
  users: (ids, tenantId) =>
    prisma.user.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true, email: true } })
      .then((r) => r.map((x) => ({ id: x.id, label: x.name || x.email }))),
};
RECORD_LABELS.quotations = RECORD_LABELS.sales;
RECORD_LABELS.bookings = RECORD_LABELS.sales;

// Para registros eliminados: el nombre sale del valor anterior guardado en la bitacora
const SNAPSHOT_NAME_FIELDS = ['name', 'fullName', 'referenceName', 'email'];

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const tenantId = sessionUser.tenantId;

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity') || '';
    const entityId = searchParams.get('entityId') || '';
    const userId = searchParams.get('userId') || '';
    const action = searchParams.get('action') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    const where: any = { tenantId };

    if (entityId) {
      // Historial de un registro: requiere el permiso de su apartado
      if (!entity) return NextResponse.json({ error: 'entity requerido' }, { status: 400 });
      const module = AUDIT_ENTITY_PERMISSION[entity];
      if (module && !(await hasPermission(module))) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
      }
      where.entityId = entityId;
      where.entity = { in: auditEntityGroup(entity) };
    } else {
      // Bitacora general: solo administradores de usuarios
      if (!(await hasPermission('usuarios'))) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
      }
      if (entity) where.entity = { in: auditEntityGroup(entity) };
      if (userId) where.userId = userId;
      if (action) where.action = action;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Resolver ids -> nombres en los cambios
    const fkIds: Record<string, Set<string>> = {};
    for (const log of logs) {
      const changes = (log.changes || {}) as Record<string, Change>;
      for (const [field, change] of Object.entries(changes)) {
        if (!FK_RESOLVERS[field] || typeof change !== 'object' || !change) continue;
        for (const v of [change.old, change.new]) {
          if (typeof v === 'string') (fkIds[field] ??= new Set()).add(v);
        }
      }
    }
    const fkNames: Record<string, Record<string, string>> = {};
    await Promise.all(
      Object.entries(fkIds).map(async ([field, ids]) => {
        const rows = await FK_RESOLVERS[field]([...ids], tenantId);
        fkNames[field] = Object.fromEntries(rows.map((r) => [r.id, r.label]));
      })
    );

    // Nombre de cada registro (solo bitacora general)
    const recordNames: Record<string, string> = {};
    if (!entityId) {
      const byEntity: Record<string, Set<string>> = {};
      for (const log of logs) {
        if (RECORD_LABELS[log.entity]) (byEntity[log.entity] ??= new Set()).add(log.entityId);
      }
      await Promise.all(
        Object.entries(byEntity).map(async ([ent, ids]) => {
          const rows = await RECORD_LABELS[ent]([...ids], tenantId);
          for (const r of rows) recordNames[r.id] = r.label;
        })
      );
    }

    const data = logs.map((log) => {
      const changes = { ...((log.changes || {}) as Record<string, any>) };
      for (const [field, names] of Object.entries(fkNames)) {
        const c = changes[field];
        if (c && typeof c === 'object') {
          changes[field] = {
            old: typeof c.old === 'string' ? names[c.old] || 'Registro eliminado' : c.old,
            new: typeof c.new === 'string' ? names[c.new] || 'Registro eliminado' : c.new,
          };
        }
      }
      let recordName: string | null = recordNames[log.entityId] || null;
      if (!recordName && !entityId) {
        const field = SNAPSHOT_NAME_FIELDS.find((f) => changes[f]?.old || changes[f]?.new);
        if (field) recordName = String(changes[field].old || changes[field].new);
      }
      return {
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        userId: log.userId,
        userName: log.userName,
        createdAt: log.createdAt,
        changes,
        recordName,
      };
    });

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Error al cargar el historial' }, { status: 500 });
  }
}
