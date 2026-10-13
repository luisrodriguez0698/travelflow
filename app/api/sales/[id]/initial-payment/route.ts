import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
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

    const transaction = await registerInitialPayment({
      tenantId: access.tenantId,
      booking,
      bankAccountId: check.bankAccountId,
      clientName: booking.client.fullName,
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
