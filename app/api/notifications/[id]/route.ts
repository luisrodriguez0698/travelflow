import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await request.json();

    const notification = await prisma.notification.findFirst({
      where: { id, tenantId },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updateData: { read?: boolean; dismissed?: boolean } = {};
    if (body.read !== undefined) updateData.read = body.read;
    if (body.dismissed !== undefined) updateData.dismissed = body.dismissed;

    const updated = await prisma.notification.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Error updating notification' }, { status: 500 });
  }
}
