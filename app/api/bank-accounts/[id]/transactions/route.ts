import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

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

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          booking: { include: { client: true } },
        },
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions,
      account,
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

      return NextResponse.json(outTransaction, { status: 201 });
    }

    return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Error creating transaction' }, { status: 500 });
  }
}
