import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import {
  RESET_CONFIRM_PHRASE,
  requireOwner,
  resolveScopes,
  verifyOwnerPassword,
  type ResetScope,
} from '@/lib/account-danger';

export const dynamic = 'force-dynamic';

// Cuantos registros hay en cada categoria (vista previa antes de borrar)
export async function GET() {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  const tenantId = owner.user.tenantId;

  const [sales, quotations, supplierPayments, bankAccounts, bankTransactions, clients, goals, audit] =
    await Promise.all([
      prismaBase.booking.count({ where: { tenantId, type: 'SALE' } }),
      prismaBase.booking.count({ where: { tenantId, type: 'QUOTATION' } }),
      prismaBase.supplierPayment.count({ where: { tenantId } }),
      prismaBase.bankAccount.count({ where: { tenantId } }),
      prismaBase.bankTransaction.count({ where: { tenantId } }),
      prismaBase.client.count({ where: { tenantId } }),
      prismaBase.salesGoal.count({ where: { tenantId } }),
      prismaBase.auditLog.count({ where: { tenantId } }),
    ]);

  return NextResponse.json({
    sales, quotations, supplierPayments, bankAccounts, bankTransactions, clients, goals, audit,
  });
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
    const { user } = owner;
    const tenantId = user.tenantId;

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== RESET_CONFIRM_PHRASE) {
      return NextResponse.json({ error: `Escribe ${RESET_CONFIRM_PHRASE} para confirmar` }, { status: 400 });
    }
    const requested: ResetScope[] = Array.isArray(body.scopes) ? body.scopes : [];
    const scopes = resolveScopes(requested);
    if (scopes.size === 0) {
      return NextResponse.json({ error: 'Selecciona qué quieres borrar' }, { status: 400 });
    }

    const passwordError = await verifyOwnerPassword(user.id, body.password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    // Proveedores, hoteles, destinos, temporadas, servicios, plantillas,
    // usuarios y roles NUNCA se tocan aqui.
    const deleted: Record<string, number> = {};
    await prismaBase.$transaction(
      async (tx) => {
        if (scopes.has('supplierPayments')) {
          deleted.supplierPayments = (await tx.supplierPayment.deleteMany({ where: { tenantId } })).count;
        }
        if (scopes.has('sales')) {
          // Cascada: servicios, pasajeros, planes de pago y notificaciones de cada venta.
          // Los movimientos bancarios ligados quedan sin venta (bookingId -> null).
          deleted.bookings = (await tx.booking.deleteMany({ where: { tenantId } })).count;
          await tx.notification.deleteMany({ where: { tenantId } });
        }
        if (scopes.has('banks')) {
          deleted.bankTransactions = (await tx.bankTransaction.deleteMany({ where: { tenantId } })).count;
          deleted.bankAccounts = (await tx.bankAccount.deleteMany({ where: { tenantId } })).count;
        }
        if (scopes.has('clients')) {
          deleted.clients = (await tx.client.deleteMany({ where: { tenantId } })).count;
        }
        if (scopes.has('goals')) {
          deleted.goals = (await tx.salesGoal.deleteMany({ where: { tenantId } })).count;
        }
        if (scopes.has('audit')) {
          deleted.audit = (await tx.auditLog.deleteMany({ where: { tenantId } })).count;
        }
      },
      { timeout: 60_000 }
    );

    // Un solo registro en la bitacora (queda aunque se haya borrado la bitacora)
    await prismaBase.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        userName: user.name,
        action: 'DELETE',
        entity: 'account',
        entityId: tenantId,
        changes: { _context: 'Restablecimiento de datos', ...deleted },
      },
    });

    return NextResponse.json({ success: true, deleted, scopes: [...scopes] });
  } catch (error) {
    console.error('Error resetting account:', error);
    return NextResponse.json({ error: 'Error al restablecer la cuenta' }, { status: 500 });
  }
}
