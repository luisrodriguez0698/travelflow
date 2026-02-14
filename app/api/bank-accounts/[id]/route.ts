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

    return NextResponse.json(account);
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
    const tenantId = await requireTenantId();
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
        accountNumber: body.accountNumber,
        accountType: body.accountType,
        referenceName: body.referenceName,
      },
    });

    return NextResponse.json(account);
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
    const tenantId = await requireTenantId();
    const { id } = await params;

    const existing = await prisma.bankAccount.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { transactions: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    if (existing._count.transactions > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una cuenta con movimientos registrados' },
        { status: 400 }
      );
    }

    await prisma.bankAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json({ error: 'Error deleting bank account' }, { status: 500 });
  }
}
