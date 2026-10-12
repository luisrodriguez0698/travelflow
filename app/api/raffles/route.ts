import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { raffleSchema } from '@/lib/raffles';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await requireAccess('rifas');
    const raffles = await prisma.raffle.findMany({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { participants: true, tickets: true } } },
    });
    const drawn = await prisma.raffleTicket.groupBy({
      by: ['raffleId'],
      where: { raffleId: { in: raffles.map((r) => r.id) }, drawnOrder: { not: null } },
      _count: { _all: true },
    });
    const drawnBy = Object.fromEntries(drawn.map((d) => [d.raffleId, d._count._all]));
    return NextResponse.json(
      raffles.map(({ _count, ...r }) => ({
        ...r,
        participantsCount: _count.participants,
        ticketsCount: _count.tickets,
        drawnCount: drawnBy[r.id] ?? 0,
      }))
    );
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching raffles:', error);
    return NextResponse.json({ error: 'Error al cargar las rifas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess('rifas', 'create');
    const parsed = raffleSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const { acceptTerms: _accepted, ...data } = parsed.data;

    if (data.sellTickets && data.bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({ where: { id: data.bankAccountId, tenantId: access.tenantId } });
      if (!bank) return NextResponse.json({ error: 'Cuenta bancaria no válida' }, { status: 400 });
    }

    const raffle = await prisma.raffle.create({
      data: {
        ...data,
        tenantId: access.tenantId,
        drawPosition: data.drawMode === 'NTH' ? data.drawPosition : null,
        ticketPrice: data.sellTickets ? data.ticketPrice : null,
        bankAccountId: data.sellTickets ? data.bankAccountId || null : null,
        autoMinAmount: data.autoTickets ? data.autoMinAmount : null,
        termsAcceptedBy: access.userId,
        termsAcceptedAt: new Date(),
        createdBy: access.userId,
      },
    });
    return NextResponse.json(raffle, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating raffle:', error);
    return NextResponse.json({ error: 'Error al crear la rifa' }, { status: 500 });
  }
}
