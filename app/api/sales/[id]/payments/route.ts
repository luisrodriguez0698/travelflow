import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Registrar un abono - puede aplicarse a múltiples pagos si hay excedente
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id: bookingId } = await params;
    const body = await request.json();

    // Verify ownership
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const { paymentId, amount, notes, bankAccountId } = body;

    if (!paymentId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Se requiere un pago válido y un monto mayor a 0' },
        { status: 400 }
      );
    }

    if (!bankAccountId) {
      return NextResponse.json(
        { error: 'Selecciona una cuenta bancaria' },
        { status: 400 }
      );
    }

    // Verify bank account ownership
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId },
    });

    if (!bankAccount) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada' }, { status: 404 });
    }

    // Get all pending payments ordered by payment number
    const allPayments = await prisma.paymentPlan.findMany({
      where: { bookingId },
      orderBy: { paymentNumber: 'asc' },
    });

    // Find the starting payment
    const startingPaymentIndex = allPayments.findIndex((p: any) => p.id === paymentId);
    if (startingPaymentIndex === -1) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    // Apply the payment amount starting from the selected payment
    let remainingAmount = amount;
    const updatedPayments = [];

    for (let i = startingPaymentIndex; i < allPayments.length && remainingAmount > 0; i++) {
      const payment = allPayments[i];
      const pendingForThisPayment = payment.amount - (payment.paidAmount || 0);

      if (pendingForThisPayment <= 0) continue; // Skip already paid payments

      const amountToApply = Math.min(remainingAmount, pendingForThisPayment);
      const newPaidAmount = (payment.paidAmount || 0) + amountToApply;
      const isPaid = newPaidAmount >= payment.amount;

      const updated = await prisma.paymentPlan.update({
        where: { id: payment.id },
        data: {
          paidAmount: newPaidAmount,
          paidDate: isPaid ? new Date() : payment.paidDate,
          status: isPaid ? 'PAID' : 'PENDING',
          notes: i === startingPaymentIndex ? (notes || payment.notes) : payment.notes,
        },
      });

      updatedPayments.push(updated);
      remainingAmount -= amountToApply;
    }

    // Check if all payments are completed
    const refreshedPayments = await prisma.paymentPlan.findMany({
      where: { bookingId },
    });

    const allPaid = refreshedPayments.every((p: any) => p.status === 'PAID');

    if (allPaid) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'COMPLETED' },
      });
    }

    // Register bank transaction for the payment
    const bookingWithClient = await prisma.booking.findFirst({
      where: { id: bookingId },
      include: { client: true, destination: true },
    });

    await prisma.$transaction([
      prisma.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId,
          type: 'INCOME',
          amount,
          description: `Abono venta - ${bookingWithClient?.client?.fullName || ''} - ${bookingWithClient?.destination?.name || ''}`,
          reference: notes || null,
          bookingId,
          date: new Date(),
        },
      }),
      prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { increment: amount } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      updatedPayments,
      message: updatedPayments.length > 1
        ? `Abono aplicado a ${updatedPayments.length} pagos`
        : 'Abono registrado correctamente'
    });
  } catch (error) {
    console.error('Error registering payment:', error);
    return NextResponse.json(
      { error: 'Error al registrar el abono' },
      { status: 500 }
    );
  }
}

// Obtener historial de pagos de una venta
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id: bookingId } = await params;

    // Verify ownership
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId, type: 'SALE' },
      include: {
        client: true,
        destination: {
          include: { season: true },
        },
        payments: {
          orderBy: { paymentNumber: 'asc' },
        },
        tenant: true,
        supplier: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    // Fetch creator name if createdBy exists
    let creatorName: string | null = null;
    if (booking.createdBy) {
      const creator = await prisma.user.findUnique({
        where: { id: booking.createdBy },
        select: { name: true, email: true },
      });
      creatorName = creator?.name || creator?.email || null;
    }

    return NextResponse.json({ ...booking, creatorName });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener los pagos' },
      { status: 500 }
    );
  }
}
