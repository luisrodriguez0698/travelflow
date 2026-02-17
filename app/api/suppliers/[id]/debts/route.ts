import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id: supplierId } = await params;

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        supplierId,
        type: 'SALE',
        status: { in: ['ACTIVE', 'COMPLETED'] },
        netCost: { gt: 0 },
      },
      include: {
        client: true,
        destination: { include: { season: true } },
        supplierPayments: {
          where: { status: 'ACTIVE' },
          orderBy: { date: 'desc' },
          include: {
            bankAccount: {
              select: { id: true, bankName: true, referenceName: true },
            },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    const now = new Date();

    const sales = bookings.map((booking) => {
      const totalPaid = booking.supplierPayments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = Math.max(0, booking.netCost - totalPaid);

      let trafficLight: 'gray' | 'green' | 'yellow' | 'red' = 'gray';
      if (remaining <= 0) {
        trafficLight = 'green';
      } else if (booking.supplierDeadline) {
        const deadline = new Date(booking.supplierDeadline);
        const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) trafficLight = 'red';
        else if (daysRemaining <= 7) trafficLight = 'yellow';
        else trafficLight = 'green';
      }

      return {
        id: booking.id,
        saleDate: booking.saleDate,
        departureDate: booking.departureDate,
        returnDate: booking.returnDate,
        netCost: booking.netCost,
        totalPrice: booking.totalPrice,
        totalPaid,
        remaining,
        supplierDeadline: booking.supplierDeadline,
        trafficLight,
        status: booking.status,
        client: booking.client,
        destination: booking.destination,
        payments: booking.supplierPayments,
      };
    });

    const summary = sales.reduce(
      (acc, sale) => ({
        totalDebt: acc.totalDebt + sale.netCost,
        totalPaid: acc.totalPaid + sale.totalPaid,
        totalRemaining: acc.totalRemaining + sale.remaining,
      }),
      { totalDebt: 0, totalPaid: 0, totalRemaining: 0 }
    );

    return NextResponse.json({ supplier, sales, summary });
  } catch (error) {
    console.error('Error fetching supplier debts:', error);
    return NextResponse.json({ error: 'Error al cargar las deudas' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id: supplierId } = await params;
    const body = await request.json();
    const { bookingId, bankAccountId, amount, notes, date } = body;

    if (!bookingId || !bankAccountId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Venta, cuenta bancaria y monto (> 0) son requeridos' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId, supplierId },
      include: { supplier: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Venta no encontrada o no vinculada a este proveedor' },
        { status: 404 }
      );
    }

    const existingPayments = await prisma.supplierPayment.findMany({
      where: { bookingId, status: 'ACTIVE' },
    });
    const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = booking.netCost - totalPaid;

    if (amount > remaining + 0.01) {
      return NextResponse.json(
        { error: `El monto excede la deuda pendiente ($${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })})` },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId },
    });

    if (!bankAccount) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada' }, { status: 404 });
    }

    if (bankAccount.currentBalance < amount) {
      return NextResponse.json(
        { error: 'Saldo insuficiente en la cuenta bancaria' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();
    const txDate = date ? new Date(date) : new Date();
    const supplierName = booking.supplier?.name || 'Proveedor';

    const supplierPayment = await prisma.$transaction(async (tx) => {
      const bankTx = await tx.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId,
          type: 'EXPENSE',
          amount,
          description: `Pago a proveedor: ${supplierName}`,
          reference: notes || null,
          bookingId,
          date: txDate,
        },
      });

      const sp = await tx.supplierPayment.create({
        data: {
          tenantId,
          bookingId,
          supplierId,
          bankAccountId,
          bankTransactionId: bankTx.id,
          amount,
          notes: notes || null,
          date: txDate,
          createdBy: sessionUser?.id || null,
        },
      });

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { decrement: amount } },
      });

      return sp;
    });

    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'CREATE',
        entity: 'supplier_payments',
        entityId: supplierPayment.id,
        changes: { supplierId, bookingId, amount, bankAccountId },
      });
    }

    return NextResponse.json(supplierPayment, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier payment:', error);
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json({ error: 'ID de pago requerido' }, { status: 400 });
    }

    const payment = await prisma.supplierPayment.findFirst({
      where: { id: paymentId, tenantId },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    if (payment.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Este pago ya está cancelado' }, { status: 400 });
    }

    const operations: any[] = [
      prisma.supplierPayment.update({
        where: { id: paymentId },
        data: { status: 'CANCELLED' },
      }),
      prisma.bankAccount.update({
        where: { id: payment.bankAccountId },
        data: { currentBalance: { increment: payment.amount } },
      }),
    ];

    if (payment.bankTransactionId) {
      operations.push(
        prisma.bankTransaction.update({
          where: { id: payment.bankTransactionId },
          data: { status: 'CANCELLED' },
        })
      );
    }

    await prisma.$transaction(operations);

    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'DELETE',
        entity: 'supplier_payments',
        entityId: paymentId,
        changes: { status: 'CANCELLED', amount: payment.amount },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling supplier payment:', error);
    return NextResponse.json({ error: 'Error al cancelar el pago' }, { status: 500 });
  }
}
