import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/get-tenant';
import { allocationPermissionError, bookingSupplierDebts, paySuppliersFromIncome, validateAllocations } from '@/lib/supplier-allocation';
import {
  findInitialPayment,
  initialPaymentAmount,
  registerInitialPayment,
  validateInitialPaymentAccount,
} from '@/lib/initial-payment';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/**
 * Registra en un banco el anticipo (o pago de contado) de una venta que se
 * guardo sin cuenta. Se fecha con la fecha de la venta (cuando se recibio).
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('ventas', 'payments');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const booking = await prisma.booking.findFirst({
      where: { id, ...access.bookingScope, type: 'SALE' },
      include: { client: { select: { fullName: true } } },
    });
    if (!booking) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    if (initialPaymentAmount(booking) <= 0) {
      return NextResponse.json({ error: 'Esta venta no tiene anticipo' }, { status: 400 });
    }
    if (await findInitialPayment(id)) {
      return NextResponse.json({ error: 'El anticipo ya está registrado en un banco' }, { status: 400 });
    }

    const check = await validateInitialPaymentAccount(access, body.bankAccountId);
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

    const debts = await bookingSupplierDebts(id, access.tenantId);
    const alloc = validateAllocations(body.supplierAllocations, debts, initialPaymentAmount(booking));
    if ('error' in alloc) return NextResponse.json({ error: alloc.error }, { status: 400 });
    const permError = allocationPermissionError(access, alloc.allocations);
    if (permError) return NextResponse.json({ error: permError }, { status: 403 });

    const transaction = await registerInitialPayment({
      tenantId: access.tenantId,
      booking,
      bankAccountId: check.bankAccountId,
      clientName: booking.client.fullName,
      date: booking.saleDate,
      note: body.initialPaymentNote,
    });
    const user = await getSessionUser();
    await paySuppliersFromIncome({
      sourceTransactionId: transaction?.id,
      access,
      bookingId: id,
      bankAccountId: check.bankAccountId,
      allocations: alloc.allocations,
      debts,
      source: booking.paymentType === 'CASH' ? 'pago de contado' : 'anticipo',
      user: user ? { id: user.id, name: user.name } : null,
      date: booking.saleDate,
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error registering initial payment:', error);
    return NextResponse.json({ error: 'No se pudo registrar el anticipo' }, { status: 500 });
  }
}
