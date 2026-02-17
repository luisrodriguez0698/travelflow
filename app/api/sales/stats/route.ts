import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // Build date range
    let dateFrom: Date;
    let dateTo: Date;
    if (month) {
      dateFrom = new Date(year, month - 1, 1);
      dateTo = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      dateFrom = new Date(year, 0, 1);
      dateTo = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        type: 'SALE',
        status: { not: 'CANCELLED' },
        saleDate: { gte: dateFrom, lte: dateTo },
      },
      select: { createdBy: true, totalPrice: true, saleDate: true },
    });

    // Aggregate by userId
    const aggregation: Record<string, { totalSales: number; salesCount: number }> = {};
    for (const b of bookings) {
      const key = b.createdBy || '__unassigned__';
      if (!aggregation[key]) aggregation[key] = { totalSales: 0, salesCount: 0 };
      aggregation[key].totalSales += b.totalPrice;
      aggregation[key].salesCount += 1;
    }

    // Enrich with user names
    const userIds = Object.keys(aggregation).filter((id) => id !== '__unassigned__');
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = Object.fromEntries(
      users.map((u) => [u.id, u.name || u.email || 'Usuario'])
    );

    const result = Object.entries(aggregation).map(([userId, stats]) => ({
      userId,
      userName: userMap[userId] ?? 'Sin asignar',
      ...stats,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    return NextResponse.json({ error: 'Error fetching sales stats' }, { status: 500 });
  }
}
