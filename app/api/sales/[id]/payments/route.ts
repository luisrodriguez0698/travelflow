import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { bookingDestination } from '@/lib/booking-destination';
import { findInitialPayment, initialPaymentAmount } from '@/lib/initial-payment';
import { allocationPermissionError, bookingSupplierDebts, paySuppliersFromIncome, validateAllocations } from '@/lib/supplier-allocation';
import { getSessionUser } from '@/lib/get-tenant';
import { notifyActivity, formatMoney } from '@/lib/activity';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Registrar un abono - puede aplicarse a múltiples pagos si hay excedente
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('ventas', 'payments');
    const tenantId = access.tenantId;
    const { id: bookingId } = await params;
    const body = await request.json();

    // Verify ownership
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, ...access.bookingScope },
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

    // Fecha en que entro el dinero (por defecto ahora). No puede ser futura.
    let paidAt = new Date();
    if (body.paidAt) {
      const parsed = new Date(body.paidAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Fecha del abono no válida' }, { status: 400 });
      }
      if (parsed.getTime() > Date.now() + 60 * 60 * 1000) {
        return NextResponse.json({ error: 'La fecha del abono no puede ser futura' }, { status: 400 });
      }
      paidAt = parsed;
    }

    // Verify bank account ownership
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, ...access.bankScope, isActive: true },
    });

    if (!bankAccount) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada' }, { status: 404 });
    }

    // Parte del abono que se paga en ese momento a proveedores (se valida antes de tocar nada)
    const supplierDebts = await bookingSupplierDebts(bookingId, tenantId);
    const alloc = validateAllocations(body.supplierAllocations, supplierDebts, amount);
    if ('error' in alloc) return NextResponse.json({ error: alloc.error }, { status: 400 });
    const permError = allocationPermissionError(access, alloc.allocations);
    if (permError) return NextResponse.json({ error: permError }, { status: 403 });

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
          paidDate: isPaid ? paidAt : payment.paidDate,
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

    const [incomeTx] = await prisma.$transaction([
      prisma.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId,
          type: 'INCOME',
          amount,
          description: `Abono venta - ${bookingWithClient?.client?.fullName || ''} - ${bookingWithClient?.destination?.name || ''}`,
          reference: notes || null,
          bookingId,
          date: paidAt,
        },
      }),
      prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { increment: amount } },
      }),
    ]);

    const actor = await getSessionUser();
    await paySuppliersFromIncome({
      sourceTransactionId: incomeTx.id,
      access,
      bookingId,
      bankAccountId,
      allocations: alloc.allocations,
      debts: supplierDebts,
      source: 'abono',
      user: actor ? { id: actor.id, name: actor.name } : null,
      date: paidAt,
    });
    if (actor) {
      await notifyActivity({
        tenantId,
        actor: { id: actor.id, name: actor.name },
        type: 'PAYMENT_RECEIVED',
        title: 'Abono registrado',
        body: `${actor.name} registró un abono de ${formatMoney(amount)} de ${bookingWithClient?.client?.fullName || 'un cliente'} en ${bankAccount.referenceName}`,
        url: `/sales/${bookingId}`,
      });
    }

    return NextResponse.json({
      success: true,
      updatedPayments,
      message: updatedPayments.length > 1
        ? `Abono aplicado a ${updatedPayments.length} pagos`
        : 'Abono registrado correctamente'
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
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
    const access = await requireAccess('ventas');
    const tenantId = access.tenantId;
    const { id: bookingId } = await params;

    // Verify ownership
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, ...access.bookingScope, type: 'SALE' },
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
        items: {
          include: { hotel: { include: { destination: { include: { season: true } } } }, destination: { include: { season: true } } },
          orderBy: { sortOrder: 'asc' },
        },
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

    // Destino general (ventas nuevas: el de sus servicios) para el detalle y el PDF
    const derived = bookingDestination(booking);
    const destination = booking.destination ?? (derived.name ? { name: derived.name, season: derived.season } : null);

    // Anticipo / pago de contado: si ya entro a un banco
    const initialTx = initialPaymentAmount(booking) > 0 ? await findInitialPayment(booking.id) : null;
    const initialPayment = {
      amount: initialPaymentAmount(booking),
      account: initialTx ? { name: initialTx.bankAccount.referenceName, bank: initialTx.bankAccount.bankName, date: initialTx.date } : null,
    };

    return NextResponse.json({ ...booking, destination, creatorName, initialPayment });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener los pagos' },
      { status: 500 }
    );
  }
}
