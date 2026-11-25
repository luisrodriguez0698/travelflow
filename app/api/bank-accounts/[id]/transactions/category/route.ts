import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { isExpenseCategory } from '@/lib/bank-categories';
import { getSessionUser } from '@/lib/get-tenant';
import { logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Cambia la categoria de un egreso capturado a mano (no toca montos ni saldos). */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess('bancos', 'edit');
    const { id: accountId } = await params;
    const body = await request.json().catch(() => ({}));
    const { transactionId, category } = body as { transactionId?: string; category?: unknown };
    if (!transactionId || !isExpenseCategory(category)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
    }

    const account = await prisma.bankAccount.findFirst({ where: { id: accountId, ...access.bankScope }, select: { id: true } });
    if (!account) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const tx = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankAccountId: accountId, tenantId: access.tenantId, type: 'EXPENSE' },
      select: { id: true, category: true, supplierPayment: { select: { id: true } }, reference: true },
    });
    if (!tx) return NextResponse.json({ error: 'Egreso no encontrado' }, { status: 404 });
    // Los egresos automaticos ya tienen su origen (proveedor, gasto fijo, comisiones)
    if (tx.supplierPayment || tx.reference === 'Gasto fijo' || tx.reference === 'Comisiones y sueldos') {
      return NextResponse.json({ error: 'Este egreso se registró desde otro apartado y no usa categoría' }, { status: 400 });
    }

    await prisma.bankTransaction.update({ where: { id: tx.id }, data: { category } });
    const su = await getSessionUser();
    if (su) {
      await logAudit({
        tenantId: access.tenantId,
        userId: su.id,
        userName: su.name,
        action: 'UPDATE',
        entity: 'bank_transactions',
        entityId: tx.id,
        changes: { category: { old: tx.category, new: category } },
      });
    }
    return NextResponse.json({ success: true, category });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating transaction category:', error);
    return NextResponse.json({ error: 'No se pudo cambiar la categoría' }, { status: 500 });
  }
}
