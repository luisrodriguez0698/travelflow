import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('bancos');
    const { id } = await params;

    const account = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { booking: { include: { client: true } } },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ...account, accountNumber: decrypt(account.accountNumber) });
  } catch (error) {
    console.error('Error fetching bank account:', error);
    return NextResponse.json({ error: 'Error fetching bank account' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('bancos');
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const account = await prisma.bankAccount.update({
      where: { id },
      data: {
        bankName: body.bankName,
        accountNumber: encrypt(body.accountNumber),
        accountType: body.accountType,
        referenceName: body.referenceName,
      },
    });

    return NextResponse.json({ ...account, accountNumber: decrypt(account.accountNumber) });
  } catch (error) {
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Error updating bank account' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('bancos');
    const { id } = await params;

    // transferToAccountId is optional — required only when balance > 0
    let transferToAccountId: string | null = null;
    try {
      const body = await request.json();
      transferToAccountId = body?.transferToAccountId || null;
    } catch {
      // No body provided
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id, tenantId, isActive: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const balance = account.currentBalance;

    // If balance > 0 and no transfer target provided, inform the client
    if (balance > 0 && !transferToAccountId) {
      return NextResponse.json(
        { error: 'La cuenta tiene saldo pendiente', needsTransfer: true, balance },
        { status: 400 }
      );
    }

    // If balance > 0, move it to the target account first
    if (balance > 0 && transferToAccountId) {
      if (transferToAccountId === id) {
        return NextResponse.json({ error: 'La cuenta destino debe ser diferente' }, { status: 400 });
      }

      const destAccount = await prisma.bankAccount.findFirst({
        where: { id: transferToAccountId, tenantId, isActive: true },
      });

      if (!destAccount) {
        return NextResponse.json({ error: 'Cuenta destino no encontrada' }, { status: 404 });
      }

      await prisma.$transaction([
        prisma.bankTransaction.create({
          data: {
            tenantId,
            bankAccountId: id,
            type: 'TRANSFER',
            amount: balance,
            description: `Transferencia al archivar cuenta: ${account.referenceName}`,
            destinationAccountId: transferToAccountId,
            date: new Date(),
          },
        }),
        prisma.bankTransaction.create({
          data: {
            tenantId,
            bankAccountId: transferToAccountId,
            type: 'INCOME',
            amount: balance,
            description: `Saldo recibido de cuenta archivada: ${account.referenceName}`,
            date: new Date(),
          },
        }),
        prisma.bankAccount.update({
          where: { id },
          data: { currentBalance: 0 },
        }),
        prisma.bankAccount.update({
          where: { id: transferToAccountId },
          data: { currentBalance: { increment: balance } },
        }),
      ]);
    }

    // Soft delete: mark inactive and record deletion date, history is preserved
    await prisma.bankAccount.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error archiving bank account:', error);
    return NextResponse.json({ error: 'Error al archivar la cuenta' }, { status: 500 });
  }
}
