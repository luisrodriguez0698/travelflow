import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('ventas');
    const tenantId = access.tenantId;
    const { id } = await params;

    const existing = await prisma.salesGoal.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.salesGoal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting sales goal:', error);
    return NextResponse.json({ error: 'Error deleting sales goal' }, { status: 500 });
  }
}
