import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { planError, suggestedAmounts } from '@/lib/payment-plan';
import { allocationPermissionError, bookingSupplierDebts, paySuppliersFromIncome, validateAllocations, type Allocation, type SupplierDebt } from '@/lib/supplier-allocation';
import { initialPaymentAmount, registerInitialPayment, validateInitialPaymentAccount } from '@/lib/initial-payment';
import { hasPermission, getSessionUser } from '@/lib/get-tenant';
import { notifyActivity, formatMoney } from '@/lib/activity';
import { checkGoalReached } from '@/lib/goals';
import { addAutoTicketsForSale } from '@/lib/raffles';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('cotizaciones', 'edit');
    const tenantId = access.tenantId;
    // Convertir crea una venta: tambien exige el permiso de ventas
    if (!(await hasPermission('ventas', 'create'))) throw new Error('Forbidden');
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const bankAccountId = body.bankAccountId || null;

    const booking = await prisma.booking.findFirst({
      where: { id, ...access.bookingScope, type: 'QUOTATION' },
      include: { client: true, destination: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Si hay anticipo (o es de contado), la cuenta donde entra es obligatoria
    let initialAccount: string | null = null;
    if (initialPaymentAmount(booking) > 0) {
      const check = await validateInitialPaymentAccount(access, bankAccountId);
      if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });
      initialAccount = check.bankAccountId;
    }

    // Parte del anticipo que se paga en ese momento a proveedores
    let supplierDebts: SupplierDebt[] = [];
    let allocations: Allocation[] = [];
    if (initialAccount && Array.isArray(body.supplierAllocations) && body.supplierAllocations.length) {
      supplierDebts = await bookingSupplierDebts(id, tenantId);
      const alloc = validateAllocations(body.supplierAllocations, supplierDebts, initialPaymentAmount(booking));
      if ('error' in alloc) return NextResponse.json({ error: alloc.error }, { status: 400 });
      const permError = allocationPermissionError(access, alloc.allocations);
      if (permError) return NextResponse.json({ error: permError }, { status: 403 });
      allocations = alloc.allocations;
    }

    // Convert to sale
    await prisma.booking.update({
      where: { id },
      data: {
        type: 'SALE',
        saleDate: new Date(),
        expirationDate: null,
        status: booking.paymentType === 'CASH' ? 'COMPLETED' : 'ACTIVE',
      },
    });

    // Anticipo (o pago de contado): entra a la cuenta elegida
    if (initialAccount) {
      const income = await registerInitialPayment({ tenantId, booking: { ...booking, saleDate: new Date() }, bankAccountId: initialAccount, clientName: booking.client?.fullName || 'Cliente', note: body.initialPaymentNote });
      const payer = await getSessionUser();
      await paySuppliersFromIncome({
        sourceTransactionId: income?.id,
        access,
        bookingId: id,
        bankAccountId: initialAccount,
        allocations,
        debts: supplierDebts,
        source: booking.paymentType === 'CASH' ? 'pago de contado' : 'anticipo',
        user: payer ? { id: payer.id, name: payer.name } : null,
      });
    }

    // Regenerate payment plan with fresh dates for credit sales
    if (booking.paymentType === 'CREDIT' && booking.numberOfPayments > 0) {
      const remaining = booking.totalPrice - (booking.downPayment || 0);
      // Se conservan los montos que se pactaron en la cotizacion (solo cambian las fechas)
      const previous = await prisma.paymentPlan.findMany({ where: { bookingId: id }, orderBy: { paymentNumber: 'asc' } });
      const previousAmounts = previous.map((p) => p.amount);
      const amounts =
        previousAmounts.length === booking.numberOfPayments && !planError(previousAmounts, remaining)
          ? previousAmounts
          : suggestedAmounts(remaining, booking.numberOfPayments);
      await prisma.paymentPlan.deleteMany({ where: { bookingId: id } });

      const payments = [];
      const frequency = booking.paymentFrequency || 'QUINCENAL';

      const getNextQuincenalDate = (fromDate: Date, count: number): Date => {
        const result = new Date(fromDate);
        for (let i = 0; i < count; i++) {
          const currentDay = result.getDate();
          const currentMonth = result.getMonth();
          const currentYear = result.getFullYear();
          const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          if (currentDay < 15) { result.setDate(15); }
          else if (currentDay < lastDayOfMonth) { result.setDate(lastDayOfMonth); }
          else { result.setDate(1); result.setMonth(currentMonth + 1); result.setDate(15); }
        }
        return result;
      };

      const getNextMonthlyDate = (fromDate: Date, count: number): Date => {
        const result = new Date(fromDate);
        result.setDate(1); // avoid overflow
        result.setMonth(result.getMonth() + count);
        result.setDate(new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate());
        return result;
      };

      const startDate = body?.paymentStartDate ? new Date(body.paymentStartDate) : new Date();
      for (let i = 0; i < booking.numberOfPayments; i++) {
        const dueDate = frequency === 'MENSUAL'
          ? getNextMonthlyDate(startDate, i)
          : getNextQuincenalDate(startDate, i + 1);
        payments.push({
          bookingId: id,
          paymentNumber: i + 1,
          dueDate,
          amount: amounts[i],
          status: 'PENDING',
        });
      }

      await prisma.paymentPlan.createMany({ data: payments });
    }


    // Una cotizacion convertida es una venta nueva para el equipo
    const actor = await getSessionUser();
    if (actor) {
      await notifyActivity({
        tenantId,
        actor: { id: actor.id, name: actor.name },
        type: 'SALE_CREATED',
        title: 'Nueva venta',
        body: `${actor.name} convirtió una cotización en venta: ${booking.client?.fullName || 'un cliente'} por ${formatMoney(booking.totalPrice)}`,
        url: `/sales/${id}`,
      });
    }
    // La venta cuenta para quien hizo la cotizacion
    if (booking.createdBy) {
      await checkGoalReached({ tenantId, sellerId: booking.createdBy, saleDate: new Date(), saleAmount: booking.totalPrice });
    }
    await addAutoTicketsForSale({
      tenantId,
      bookingId: id,
      clientId: booking.clientId,
      sellerId: booking.createdBy,
      totalPrice: booking.totalPrice,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error converting quotation:', error);
    return NextResponse.json({ error: 'Error al convertir la cotización' }, { status: 500 });
  }
}
