import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('bancos');
    const { id } = await params;

    const account = await prisma.bankAccount.findFirst({
      where: { id, ...access.bankScope },
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
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching bank account:', error);
    return NextResponse.json({ error: 'Error fetching bank account' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('bancos', 'edit');
    const { id } = await params;
    const body = await request.json();

    // Solo el dueno (o quien ve todo) edita la cuenta; las compartidas se usan pero no se editan
    const existing = await prisma.bankAccount.findFirst({
      where: { id, ...access.bankOwnScope },
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
        ...(typeof body.shared === 'boolean' && { shared: body.shared }),
      },
    });

    return NextResponse.json({ ...account, accountNumber: decrypt(account.accountNumber) });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Error updating bank account' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('bancos', 'delete');
    const tenantId = access.tenantId;
    const { id } = await params;

    // transferToAccountId / adjustToZero are optional — one of them is required only when balance > 0
    let transferToAccountId: string | null = null;
    let adjustToZero = false;
    try {
      const body = await request.json();
      transferToAccountId = body?.transferToAccountId || null;
      adjustToZero = body?.adjustToZero === true;
    } catch {
      // No body provided
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id, ...access.bankOwnScope, isActive: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const balance = account.currentBalance;

    // If balance > 0 and no transfer target or adjustment provided, inform the client
    if (balance > 0 && !transferToAccountId && !adjustToZero) {
      return NextResponse.json(
        { error: 'La cuenta tiene saldo pendiente', needsTransfer: true, balance },
        { status: 400 }
      );
    }

    // If balance > 0 and no other account exists, settle it with an adjustment entry instead of a transfer
    if (balance > 0 && adjustToZero) {
      await prisma.$transaction([
        prisma.bankTransaction.create({
          data: {
            tenantId,
            bankAccountId: id,
            type: 'EXPENSE',
            amount: balance,
            description: `Ajuste de cierre por archivo de cuenta: ${account.referenceName}`,
            date: new Date(),
          },
        }),
        prisma.bankAccount.update({
          where: { id },
          data: { currentBalance: 0 },
        }),
      ]);
    }

    // If balance > 0, move it to the target account first
    if (balance > 0 && transferToAccountId) {
      if (transferToAccountId === id) {
        return NextResponse.json({ error: 'La cuenta destino debe ser diferente' }, { status: 400 });
      }

      const destAccount = await prisma.bankAccount.findFirst({
        where: { id: transferToAccountId, ...access.bankScope, isActive: true },
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
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error archiving bank account:', error);
    return NextResponse.json({ error: 'Error al archivar la cuenta' }, { status: 500 });
  }
}

// Restore a previously archived account
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('bancos', 'edit');
    const { id } = await params;

    const existing = await prisma.bankAccount.findFirst({
      where: { id, ...access.bankOwnScope, isActive: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cuenta no encontrada o no está archivada' }, { status: 404 });
    }

    const account = await prisma.bankAccount.update({
      where: { id },
      data: { isActive: true, deletedAt: null },
    });

    return NextResponse.json({ ...account, accountNumber: decrypt(account.accountNumber) });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error restoring bank account:', error);
    return NextResponse.json({ error: 'Error al restaurar la cuenta' }, { status: 500 });
  }
}
