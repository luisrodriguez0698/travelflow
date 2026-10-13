import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Corrige la cuenta de un movimiento (se registro en la cuenta equivocada):
 * lo pasa a la cuenta correcta y ajusta ambos saldos. No toca la venta, sus
 * abonos ni la deuda del proveedor (solo cambia DONDE entro/salio el dinero).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess('bancos', 'edit');
    const { id: accountId } = await params;
    const body = await request.json().catch(() => ({}));
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId : '';
    const targetAccountId = typeof body.targetAccountId === 'string' ? body.targetAccountId : '';
    if (!transactionId || !targetAccountId) {
      return NextResponse.json({ error: 'Indica el movimiento y la cuenta correcta' }, { status: 400 });
    }
    if (targetAccountId === accountId) {
      return NextResponse.json({ error: 'Elige una cuenta distinta' }, { status: 400 });
    }

    // Solo quien administra la cuenta de origen puede corregir sus movimientos
    const source = await prisma.bankAccount.findFirst({ where: { id: accountId, ...access.bankOwnScope } });
    if (!source) {
      return NextResponse.json({ error: 'Solo quien administra la cuenta puede corregir sus movimientos' }, { status: 403 });
    }
    const target = await prisma.bankAccount.findFirst({ where: { id: targetAccountId, ...access.bankScope, isActive: true } });
    if (!target) return NextResponse.json({ error: 'Cuenta destino no válida' }, { status: 400 });

    const tx = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankAccountId: accountId, tenantId: access.tenantId },
    });
    if (!tx) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    if (tx.status !== 'ACTIVE') return NextResponse.json({ error: 'El movimiento está cancelado' }, { status: 400 });
    if (tx.type !== 'INCOME' && tx.type !== 'EXPENSE') {
      return NextResponse.json({ error: 'Las transferencias no se mueven: cancélala y vuelve a hacerla' }, { status: 400 });
    }
    if (tx.type === 'EXPENSE' && target.currentBalance < tx.amount) {
      return NextResponse.json({ error: `Saldo insuficiente en ${target.referenceName} para este egreso` }, { status: 400 });
    }

    const income = tx.type === 'INCOME';
    await prisma.$transaction([
      prisma.bankTransaction.update({ where: { id: tx.id }, data: { bankAccountId: target.id } }),
      prisma.bankAccount.update({
        where: { id: source.id },
        data: { currentBalance: income ? { decrement: tx.amount } : { increment: tx.amount } },
      }),
      prisma.bankAccount.update({
        where: { id: target.id },
        data: { currentBalance: income ? { increment: tx.amount } : { decrement: tx.amount } },
      }),
      // Si era un pago a proveedor, su registro tambien queda en la cuenta correcta
      prisma.supplierPayment.updateMany({ where: { bankTransactionId: tx.id }, data: { bankAccountId: target.id } }),
    ]);

    const user = await getSessionUser();
    if (user) {
      await logAudit({
        tenantId: access.tenantId,
        userId: user.id,
        userName: user.name,
        action: 'UPDATE',
        entity: 'bank_accounts',
        entityId: source.id,
        changes: {
          _context: `Movimiento movido de cuenta: ${tx.description} ($${tx.amount.toLocaleString('es-MX')})`,
          bankAccountId: { old: source.id, new: target.id },
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error moving transaction:', error);
    return NextResponse.json({ error: 'No se pudo mover el movimiento' }, { status: 500 });
  }
}
