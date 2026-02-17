import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '0');
    const year = parseInt(searchParams.get('year') || '0');

    const where: any = { tenantId };
    if (month) where.month = month;
    if (year) where.year = year;

    const goals = await prisma.salesGoal.findMany({ where });

    // Enrich with user names
    const userIds = [...new Set(goals.map((g) => g.userId))];
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

    return NextResponse.json(
      goals.map((g) => ({ ...g, userName: userMap[g.userId] ?? null }))
    );
  } catch (error) {
    console.error('Error fetching sales goals:', error);
    return NextResponse.json({ error: 'Error fetching sales goals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();
    const { userId, month, year, goalAmount } = body;

    if (!userId || !month || !year || goalAmount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const goal = await prisma.salesGoal.upsert({
      where: {
        tenantId_userId_month_year: { tenantId, userId, month, year },
      },
      create: { tenantId, userId, month, year, goalAmount },
      update: { goalAmount },
    });

    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'UPDATE',
        entity: 'sales_goals',
        entityId: goal.id,
        changes: { userId, month, year, goalAmount },
      });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error('Error saving sales goal:', error);
    return NextResponse.json({ error: 'Error saving sales goal' }, { status: 500 });
  }
}
