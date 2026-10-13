import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { correctCollection, voidCollection } from '@/lib/sale-collections';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string; txId: string } };

/**
 * Corrige o anula un cobro en un solo paso.
 * body: { action: 'correct', bankAccountId, supplierAllocations } | { action: 'void' }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('ventas', 'payments');
    const { id, txId } = await params;
    const body = await request.json().catch(() => ({}));
    const booking = await prisma.booking.findFirst({ where: { id, ...access.bookingScope, type: 'SALE' }, select: { id: true } });
    if (!booking) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });

    const sessionUser = await getSessionUser();
    const user = sessionUser ? { id: sessionUser.id, name: sessionUser.name } : null;
    const result =
      body.action === 'void'
        ? await voidCollection({ access, bookingId: id, incomeId: txId, user })
        : await correctCollection({
            access,
            bookingId: id,
            incomeId: txId,
            bankAccountId: body.bankAccountId,
            allocations: body.supplierAllocations,
            user,
          });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error correcting collection:', error);
    return NextResponse.json({ error: 'No se pudo aplicar la corrección' }, { status: 500 });
  }
}
