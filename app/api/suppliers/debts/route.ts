import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();

    // Get all suppliers that have at least one sale with netCost > 0
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Get all bookings with supplier + their payments in bulk
    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        supplierId: { not: null },
        type: 'SALE',
        status: { in: ['ACTIVE', 'COMPLETED'] },
        netCost: { gt: 0 },
      },
      include: {
        supplierPayments: {
          where: { status: 'ACTIVE' },
          select: { amount: true },
        },
      },
    });

    const now = new Date();

    // Group by supplier
    const supplierMap = new Map<string, {
      totalDebt: number;
      totalPaid: number;
      totalRemaining: number;
      salesCount: number;
      overdueCount: number;
    }>();

    for (const booking of bookings) {
      if (!booking.supplierId) continue;

      const totalPaid = booking.supplierPayments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = Math.max(0, booking.netCost - totalPaid);

      const existing = supplierMap.get(booking.supplierId) || {
        totalDebt: 0, totalPaid: 0, totalRemaining: 0, salesCount: 0, overdueCount: 0,
      };

      existing.totalDebt += booking.netCost;
      existing.totalPaid += totalPaid;
      existing.totalRemaining += remaining;
      existing.salesCount += 1;

      if (remaining > 0 && booking.supplierDeadline) {
        const daysRemaining = Math.ceil(
          (new Date(booking.supplierDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysRemaining < 0) existing.overdueCount += 1;
      }

      supplierMap.set(booking.supplierId, existing);
    }

    // Merge supplier info with debt data
    const result = suppliers
      .map((s) => {
        const debt = supplierMap.get(s.id);
        if (!debt || debt.salesCount === 0) return null;
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          serviceType: s.serviceType,
          ...debt,
        };
      })
      .filter(Boolean);

    // Global totals
    const totals = result.reduce(
      (acc, s: any) => ({
        totalDebt: acc.totalDebt + s.totalDebt,
        totalPaid: acc.totalPaid + s.totalPaid,
        totalRemaining: acc.totalRemaining + s.totalRemaining,
      }),
      { totalDebt: 0, totalPaid: 0, totalRemaining: 0 }
    );

    return NextResponse.json({ data: result, totals });
  } catch (error) {
    console.error('Error fetching supplier debts summary:', error);
    return NextResponse.json({ error: 'Error al cargar resumen de deudas' }, { status: 500 });
  }
}
