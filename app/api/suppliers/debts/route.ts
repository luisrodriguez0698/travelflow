import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess('proveedores');
    const tenantId = access.tenantId;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get all suppliers
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Get all bookings with their items and payments
    const bookings = await prisma.booking.findMany({
      where: {
        ...access.bookingScope,
        type: 'SALE',
        status: { in: ['ACTIVE', 'COMPLETED'] },
        OR: [
          { supplierId: { not: null }, netCost: { gt: 0 } },
          { items: { some: { supplierId: { not: null }, cost: { gt: 0 } } } },
        ],
      },
      include: {
        client: { select: { fullName: true } },
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

    // Fechas limite con saldo pendiente (para el semaforo de deudas)
    const deadlines: { bookingId: string; supplierId: string; client: string; remaining: number; deadline: string; daysRemaining: number }[] = [];

    const addToSupplier = (
      suppId: string,
      debt: number,
      paid: number,
      deadline: Date | null | undefined,
      meta?: { bookingId: string; client: string }
    ) => {
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
        if (meta && remaining > 0.01) {
          deadlines.push({ ...meta, supplierId: suppId, remaining, deadline: new Date(deadline).toISOString(), daysRemaining });
        }
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
          addToSupplier(item.supplierId, item.cost, paid, item.supplierDeadline, { bookingId: booking.id, client: booking.client?.fullName ?? 'Cliente' });
        }
      } else if (booking.supplierId && booking.netCost > 0) {
        // Old way: single supplier at booking level
        const paid = paymentsBySupplierId.get(booking.supplierId) || 0;
        addToSupplier(booking.supplierId, booking.netCost, paid, (booking as any).supplierDeadline, { bookingId: booking.id, client: booking.client?.fullName ?? 'Cliente' });
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

    // Global totals — computed over the full result set, before pagination slices it
    const totals = result.reduce(
      (acc, s: any) => ({
        totalDebt: acc.totalDebt + s.totalDebt,
        totalPaid: acc.totalPaid + s.totalPaid,
        totalRemaining: acc.totalRemaining + s.totalRemaining,
      }),
      { totalDebt: 0, totalPaid: 0, totalRemaining: 0 }
    );

    const total = result.length;
    const paged = result.slice((page - 1) * limit, page * limit);

    // Lo mas urgente primero: vencidas y las de los proximos 30 dias
    const supplierNames = new Map(suppliers.map((sp) => [sp.id, sp.name]));
    const urgent = deadlines
      .filter((d) => d.daysRemaining <= 30)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 8)
      .map((d) => ({ ...d, supplier: supplierNames.get(d.supplierId) ?? 'Proveedor', remaining: Math.round(d.remaining * 100) / 100 }));

    return NextResponse.json({
      data: paged,
      totals,
      deadlines: urgent,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching supplier debts summary:', error);
    return NextResponse.json({ error: 'Error al cargar resumen de deudas' }, { status: 500 });
  }
}
