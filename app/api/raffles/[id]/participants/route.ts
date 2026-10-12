import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { participantSchema, setParticipantTickets } from '@/lib/raffles';
import { validateParticipant } from '@/lib/raffle-participants';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas', 'create');
    const { id } = await params;
    const parsed = participantSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const body = parsed.data;

    const check = await validateParticipant(access, id, body);
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });
    const { raffle, sellerId } = check;

    // Cobro de boletos: solo si la rifa los vende
    const payment = raffle.sellTickets ? body.payment : null;
    if (payment) {
      const bank = await prisma.bankAccount.findFirst({ where: { id: payment.bankAccountId, ...access.bankScope, isActive: true } });
      if (!bank) return NextResponse.json({ error: 'Cuenta bancaria no válida' }, { status: 400 });
    }

    const participant = await prisma.$transaction(async (tx) => {
      const created = await tx.raffleParticipant.create({
        data: {
          raffleId: id,
          tenantId: access.tenantId,
          name: body.name,
          phone: body.phone || null,
          clientId: body.clientId || null,
          sellerId,
          source: body.clientId ? 'CLIENT' : 'MANUAL',
          paidAmount: payment?.amount ?? 0,
          createdBy: access.userId,
        },
      });
      await setParticipantTickets(tx, id, created.id, body.tickets);
      if (payment) {
        await tx.bankTransaction.create({
          data: {
            tenantId: access.tenantId,
            bankAccountId: payment.bankAccountId,
            type: 'INCOME',
            amount: payment.amount,
            description: `Rifa "${raffle.name}" - ${body.tickets} boleto(s) de ${body.name}`,
            date: new Date(),
          },
        });
        await tx.bankAccount.update({ where: { id: payment.bankAccountId }, data: { currentBalance: { increment: payment.amount } } });
      }
      return created;
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error adding participant:', error);
    return NextResponse.json({ error: 'Error al agregar el participante' }, { status: 500 });
  }
}
