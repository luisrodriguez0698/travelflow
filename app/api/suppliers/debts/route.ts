import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();

    // Get all suppliers
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Get all bookings with their items and payments
    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        type: 'SALE',
        status: { in: ['ACTIVE', 'COMPLETED'] },
        OR: [
          { supplierId: { not: null }, netCost: { gt: 0 } },
          { items: { some: { supplierId: { not: null }, cost: { gt: 0 } } } },
        ],
      },
      include: {
        items: {
          where: { supplierId: { not: null }, cost: { gt: 0 } },
          select: { supplierId: true, cost: true, supplierDeadline: true },
        },
        supplierPayments: {
          where: { status: 'ACTIVE' },
          select: { amount: true, supplierId: true },
        },
      },
    });

    const now = new Date();

    const supplierMap = new Map<string, {
      totalDebt: number;
      totalPaid: number;
      totalRemaining: number;
      salesCount: number;
      overdueCount: number;
    }>();

    const addToSupplier = (suppId: string, debt: number, paid: number, deadline: Date | null | undefined) => {
      const remaining = Math.max(0, debt - paid);
      const existing = supplierMap.get(suppId) || {
        totalDebt: 0, totalPaid: 0, totalRemaining: 0, salesCount: 0, overdueCount: 0,
      };
      existing.totalDebt += debt;
      existing.totalPaid += paid;
      existing.totalRemaining += remaining;
      existing.salesCount += 1;

      if (remaining > 0 && deadline) {
        const daysRemaining = Math.ceil(
          (new Date(deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysRemaining < 0) existing.overdueCount += 1;
      }
      supplierMap.set(suppId, existing);
    };

    for (const booking of bookings) {
      const hasItemSuppliers = booking.items.length > 0;

      // Payments grouped by supplierId for this booking
      const paymentsBySupplierId = new Map<string, number>();
      for (const p of booking.supplierPayments) {
        if (p.supplierId) {
          paymentsBySupplierId.set(p.supplierId, (paymentsBySupplierId.get(p.supplierId) || 0) + p.amount);
        }
      }

      if (hasItemSuppliers) {
        // New way: each item has its own supplier — aggregate by item
        for (const item of booking.items) {
          if (!item.supplierId) continue;
          const paid = paymentsBySupplierId.get(item.supplierId) || 0;
          addToSupplier(item.supplierId, item.cost, paid, item.supplierDeadline);
        }
      } else if (booking.supplierId && booking.netCost > 0) {
        // Old way: single supplier at booking level
        const paid = paymentsBySupplierId.get(booking.supplierId) || 0;
        addToSupplier(booking.supplierId, booking.netCost, paid, (booking as any).supplierDeadline);
      }
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
