import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint es requerido' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json({ error: 'Error al eliminar la suscripción' }, { status: 500 });
  }
}
