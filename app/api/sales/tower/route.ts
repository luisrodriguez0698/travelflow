import { NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { userNames } from '@/lib/list-query';

export const dynamic = 'force-dynamic';

// Torre de control de ventas a credito: en que etapa va cada venta, quien esta
// atrasado, que cobros vienen y cuanto ha entrado en el mes.

type TowerStatus = 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'SETTLED';

const DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  try {
    const access = await requireAccess('ventas');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const soon = new Date(today.getTime() + 8 * DAY); // hoy + 7 dias completos
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ventas a credito vivas: activas, o liquidadas cuyo viaje aun no pasa (o paso hace poco)
    const bookings = await prisma.booking.findMany({
      where: {
        ...access.bookingScope,
        type: 'SALE',
        paymentType: 'CREDIT',
        OR: [
          { status: 'ACTIVE' },
          { status: 'COMPLETED', OR: [{ departureDate: null }, { departureDate: { gte: new Date(today.getTime() - 30 * DAY) } }] },
        ],
      },
      select: {
        id: true,
        createdBy: true,
        totalPrice: true,
        downPayment: true,
        departureDate: true,
        saleDate: true,
        createdAt: true,
        client: { select: { fullName: true, phone: true } },
        payments: {
          orderBy: { paymentNumber: 'asc' },
          select: { paymentNumber: true, dueDate: true, amount: true, paidAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const agents = await userNames(bookings.map((b) => b.createdBy), access.tenantId);

    let dueNext7 = 0;
    const dueNext7Clients = new Set<string>();
    let overdueTotal = 0;
    const overdueClients = new Set<string>();
    let settled = 0;

    const sales = bookings.map((b) => {
      const paid = round2((b.downPayment || 0) + b.payments.reduce((s, p) => s + (p.paidAmount || 0), 0));
      const total = b.totalPrice || 0;
      const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;
      const pending = b.payments
        .map((p) => ({ ...p, pending: round2(p.amount - (p.paidAmount || 0)) }))
        .filter((p) => p.pending > 0.01);

      const overdue = pending.filter((p) => p.dueDate < today);
      const overdueAmount = round2(overdue.reduce((s, p) => s + p.pending, 0));
      const next = pending[0] ?? null;
      const isSettled = paid >= total - 0.01 || pending.length === 0;

      for (const p of pending) {
        if (p.dueDate >= today && p.dueDate < soon) {
          dueNext7 += p.pending;
          dueNext7Clients.add(b.id);
        }
      }
      if (overdueAmount > 0) {
        overdueTotal += overdueAmount;
        overdueClients.add(b.id);
      }
      if (isSettled) settled += 1;

      const status: TowerStatus = isSettled
        ? 'SETTLED'
        : overdueAmount > 0
          ? 'OVERDUE'
          : next && next.dueDate < soon
            ? 'DUE_SOON'
            : 'ON_TRACK';

      return {
        id: b.id,
        folio: b.id.slice(-8).toUpperCase(),
        client: b.client?.fullName ?? 'Cliente',
        phone: b.client?.phone ?? null,
        agentId: b.createdBy || 'none',
        agent: b.createdBy ? agents[b.createdBy] || null : null,
        total: round2(total),
        paid,
        pct,
        status,
        overdueAmount,
        saleDate: (b.saleDate ?? b.createdAt).toISOString(),
        departureDate: b.departureDate?.toISOString() ?? null,
        next: next ? { number: next.paymentNumber, dueDate: next.dueDate.toISOString(), pending: next.pending } : null,
        payments: b.payments.map((p) => ({
          number: p.paymentNumber,
          dueDate: p.dueDate.toISOString(),
          amount: p.amount,
          paidAmount: p.paidAmount || 0,
        })),
      };
    });

    // Cobrado en el mes: anticipos y abonos que entraron a las cuentas (de estas ventas o cualquiera del alcance)
    const collected = await prisma.bankTransaction.aggregate({
      where: {
        tenantId: access.tenantId,
        type: 'INCOME',
        status: 'ACTIVE',
        date: { gte: monthStart },
        booking: { is: { ...access.bookingScope, type: 'SALE' } },
      },
      _sum: { amount: true },
    });

    // Tablero de salidas: atrasados primero y luego los que vienen
    const upcoming = sales
      .filter((s) => s.next)
      .map((s) => ({ saleId: s.id, client: s.client, phone: s.phone, agent: s.agent, status: s.status, ...s.next! }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 12);

    return NextResponse.json({
      kpis: {
        collectedMonth: round2(collected._sum.amount ?? 0),
        dueNext7: round2(dueNext7),
        dueNext7Count: dueNext7Clients.size,
        overdue: round2(overdueTotal),
        overdueCount: overdueClients.size,
        settled,
        active: sales.length,
      },
      sales,
      upcoming,
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading sales tower:', error);
    return NextResponse.json({ error: 'Error al cargar la torre de control' }, { status: 500 });
  }
}
