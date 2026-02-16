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
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const skip = (page - 1) * limit;

    // Verify account ownership
    const account = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const where: any = { bankAccountId: id };
    if (type && type !== 'ALL') {
      where.type = type;
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Monthly summary (always current month, independent of filters)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthlyTxs = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId: id,
        status: 'ACTIVE',
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { type: true, amount: true },
    });
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const tx of monthlyTxs) {
      if (tx.type === 'INCOME') monthlyIncome += tx.amount;
      if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') monthlyExpense += tx.amount;
    }

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          booking: {
            include: {
              client: true,
              destination: { include: { season: true } },
              supplier: true,
            },
          },
        },
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions,
      account,
      monthlySummary: { income: monthlyIncome, expense: monthlyExpense },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Error fetching transactions' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await request.json();

    const { type, amount, description, reference, bookingId, destinationAccountId } = body;

    if (!type || !amount || amount <= 0 || !description) {
      return NextResponse.json(
        { error: 'Campos requeridos: tipo, monto (> 0) y descripción' },
        { status: 400 }
      );
    }

    // Verify account ownership
    const account = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    if (type === 'EXPENSE') {
      if (account.currentBalance < amount) {
        return NextResponse.json(
          { error: 'Saldo insuficiente en la cuenta' },
          { status: 400 }
        );
      }

      const [transaction] = await prisma.$transaction([
        prisma.bankTransaction.create({
          data: {
            tenantId,
            bankAccountId: id,
            type: 'EXPENSE',
            amount,
            description,
            reference: reference || null,
            bookingId: bookingId || null,
            date: body.date ? new Date(body.date) : new Date(),
          },
        }),
        prisma.bankAccount.update({
          where: { id },
          data: { currentBalance: { decrement: amount } },
        }),
      ]);

      const su = await getSessionUser();
      if (su) await logAudit({ tenantId, userId: su.id, userName: su.name, action: 'CREATE', entity: 'bank_transactions', entityId: transaction.id, changes: { type: 'EXPENSE', amount, description } });

      return NextResponse.json(transaction, { status: 201 });
    }

    if (type === 'INCOME') {
      const [transaction] = await prisma.$transaction([
        prisma.bankTransaction.create({
          data: {
            tenantId,
            bankAccountId: id,
            type: 'INCOME',
            amount,
            description,
            reference: reference || null,
            bookingId: bookingId || null,
            date: body.date ? new Date(body.date) : new Date(),
          },
        }),
        prisma.bankAccount.update({
          where: { id },
          data: { currentBalance: { increment: amount } },
        }),
      ]);

      const su = await getSessionUser();
      if (su) await logAudit({ tenantId, userId: su.id, userName: su.name, action: 'CREATE', entity: 'bank_transactions', entityId: transaction.id, changes: { type: 'INCOME', amount, description } });

      return NextResponse.json(transaction, { status: 201 });
    }

    if (type === 'TRANSFER') {
      if (!destinationAccountId) {
        return NextResponse.json(
          { error: 'Selecciona una cuenta destino' },
          { status: 400 }
        );
      }

      if (destinationAccountId === id) {
        return NextResponse.json(
          { error: 'La cuenta destino debe ser diferente a la cuenta origen' },
          { status: 400 }
        );
      }

      if (account.currentBalance < amount) {
        return NextResponse.json(
          { error: 'Saldo insuficiente en la cuenta origen' },
          { status: 400 }
        );
      }

      const destAccount = await prisma.bankAccount.findFirst({
        where: { id: destinationAccountId, tenantId },
      });

      if (!destAccount) {
        return NextResponse.json({ error: 'Cuenta destino no encontrada' }, { status: 404 });
      }

      const txDate = body.date ? new Date(body.date) : new Date();

      const [outTransaction] = await prisma.$transaction([
        // Outgoing transaction (source account)
        prisma.bankTransaction.create({
          data: {
            tenantId,
            bankAccountId: id,
            type: 'TRANSFER',
            amount,
            description,
            reference: reference || null,
            destinationAccountId,
            date: txDate,
          },
        }),
        // Incoming transaction (destination account)
        prisma.bankTransaction.create({
          data: {
            tenantId,
            bankAccountId: destinationAccountId,
            type: 'INCOME',
            amount,
            description: `Transferencia desde ${account.referenceName}`,
            reference: reference || null,
            date: txDate,
          },
        }),
        // Decrease source balance
        prisma.bankAccount.update({
          where: { id },
          data: { currentBalance: { decrement: amount } },
        }),
        // Increase destination balance
        prisma.bankAccount.update({
          where: { id: destinationAccountId },
          data: { currentBalance: { increment: amount } },
        }),
      ]);

      const su = await getSessionUser();
      if (su) await logAudit({ tenantId, userId: su.id, userName: su.name, action: 'CREATE', entity: 'bank_transactions', entityId: outTransaction.id, changes: { type: 'TRANSFER', amount, description, destinationAccountId } });

      return NextResponse.json(outTransaction, { status: 201 });
    }

    return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Error creating transaction' }, { status: 500 });
  }
}

// Cancel a transaction (logical delete + reverse balance)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id: accountId } = await params;
    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'ID de transacción requerido' }, { status: 400 });
    }

    // Get the transaction
    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankAccountId: accountId, tenantId },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 });
    }

    if (transaction.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Esta transacción ya está cancelada' }, { status: 400 });
    }

    const operations: any[] = [
      // Mark transaction as cancelled
      prisma.bankTransaction.update({
        where: { id: transactionId },
        data: { status: 'CANCELLED' },
      }),
    ];

    if (transaction.type === 'INCOME') {
      // Reverse: subtract from account balance
      operations.push(
        prisma.bankAccount.update({
          where: { id: accountId },
          data: { currentBalance: { decrement: transaction.amount } },
        })
      );

      // If linked to a booking payment, reverse the payment
      if (transaction.bookingId) {
        // Get the booking payments
        const payments = await prisma.paymentPlan.findMany({
          where: { bookingId: transaction.bookingId },
          orderBy: { paymentNumber: 'desc' },
        });

        // Reverse the payment amount from payments (last paid first)
        let amountToReverse = transaction.amount;
        for (const payment of payments) {
          if (amountToReverse <= 0) break;
          if ((payment.paidAmount || 0) <= 0) continue;

          const reverseAmount = Math.min(amountToReverse, payment.paidAmount || 0);
          const newPaidAmount = (payment.paidAmount || 0) - reverseAmount;

          operations.push(
            prisma.paymentPlan.update({
              where: { id: payment.id },
              data: {
                paidAmount: newPaidAmount,
                status: newPaidAmount >= payment.amount ? 'PAID' : 'PENDING',
                paidDate: newPaidAmount >= payment.amount ? payment.paidDate : null,
              },
            })
          );

          amountToReverse -= reverseAmount;
        }

        // If booking was COMPLETED, revert to ACTIVE
        operations.push(
          prisma.booking.updateMany({
            where: { id: transaction.bookingId, status: 'COMPLETED' },
            data: { status: 'ACTIVE' },
          })
        );
      }
    } else if (transaction.type === 'EXPENSE') {
      // Reverse: add back to account balance
      operations.push(
        prisma.bankAccount.update({
          where: { id: accountId },
          data: { currentBalance: { increment: transaction.amount } },
        })
      );
    } else if (transaction.type === 'TRANSFER') {
      // Reverse: add back to source account
      operations.push(
        prisma.bankAccount.update({
          where: { id: accountId },
          data: { currentBalance: { increment: transaction.amount } },
        })
      );

      // Reverse: subtract from destination account
      if (transaction.destinationAccountId) {
        operations.push(
          prisma.bankAccount.update({
            where: { id: transaction.destinationAccountId },
            data: { currentBalance: { decrement: transaction.amount } },
          })
        );

        // Also cancel the corresponding INCOME transaction in destination account
        operations.push(
          prisma.bankTransaction.updateMany({
            where: {
              bankAccountId: transaction.destinationAccountId,
              type: 'INCOME',
              amount: transaction.amount,
              date: transaction.date,
              description: { contains: 'Transferencia desde' },
              status: 'ACTIVE',
            },
            data: { status: 'CANCELLED' },
          })
        );
      }
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true, message: 'Movimiento cancelado correctamente' });
  } catch (error) {
    console.error('Error cancelling transaction:', error);
    return NextResponse.json({ error: 'Error al cancelar el movimiento' }, { status: 500 });
  }
}
