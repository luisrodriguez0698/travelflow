import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Anula un pago a agente: el egreso se cancela (regresa el saldo) y las comisiones vuelven a quedar pendientes. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess('comisiones', 'payments');
    if (access.ownOnly) return NextResponse.json({ error: 'No puedes anular pagos de comisiones' }, { status: 403 });
    const { id } = await params;
    const payout = await prisma.commissionPayout.findFirst({ where: { id, tenantId: access.tenantId, status: 'ACTIVE' } });
    if (!payout) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      if (payout.bankTransactionId) {
        const bankTx = await tx.bankTransaction.findFirst({ where: { id: payout.bankTransactionId, tenantId: access.tenantId, status: 'ACTIVE' } });
        if (bankTx) {
          await tx.bankTransaction.update({ where: { id: bankTx.id }, data: { status: 'CANCELLED' } });
          await tx.bankAccount.update({ where: { id: bankTx.bankAccountId }, data: { currentBalance: { increment: bankTx.amount } } });
        }
      }
      await tx.commissionPayout.update({ where: { id: payout.id }, data: { status: 'CANCELLED' } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error cancelling payout:', error);
    return NextResponse.json({ error: 'No se pudo anular el pago' }, { status: 500 });
  }
}
