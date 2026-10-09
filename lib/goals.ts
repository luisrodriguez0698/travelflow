import { prisma } from './prisma';
import { publishToUser } from './realtime';
import { notifyActivity, formatMoney } from './activity';

/**
 * Si con esta venta el vendedor CRUZA su meta del mes (antes no la tenia,
 * ahora si), le manda confeti en vivo y avisa al equipo. Usa el mismo calculo
 * que la pantalla de Metas (ventas no canceladas por fecha de venta y autor).
 * Nunca lanza error: una falla aqui no debe afectar la venta.
 */
export async function checkGoalReached(input: {
  tenantId: string;
  sellerId: string;
  saleDate: Date;
  saleAmount: number;
}): Promise<void> {
  try {
    const month = input.saleDate.getMonth() + 1;
    const year = input.saleDate.getFullYear();

    const goal = await prisma.salesGoal.findUnique({
      where: { tenantId_userId_month_year: { tenantId: input.tenantId, userId: input.sellerId, month, year } },
    });
    if (!goal || goal.goalAmount <= 0) return;

    const sold = await prisma.booking.aggregate({
      where: {
        tenantId: input.tenantId,
        type: 'SALE',
        status: { not: 'CANCELLED' },
        createdBy: input.sellerId,
        saleDate: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59, 999) },
      },
      _sum: { totalPrice: true },
    });
    const total = sold._sum.totalPrice ?? 0;
    const before = total - input.saleAmount;
    if (!(before < goal.goalAmount && total >= goal.goalAmount)) return;

    const seller = await prisma.user.findUnique({ where: { id: input.sellerId }, select: { name: true, email: true } });
    const sellerName = seller?.name || seller?.email || 'Un vendedor';
    const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long' });

    // A quien la logro: confeti y felicitacion en su pantalla
    publishToUser(input.sellerId, 'celebrate', {
      title: '¡Meta alcanzada! 🎉',
      body: `Llegaste a tu meta de ${monthName}: ${formatMoney(goal.goalAmount)}. ¡Excelente trabajo!`,
    });

    // Al equipo (Admin / Contador): aviso en la campana
    await notifyActivity({
      tenantId: input.tenantId,
      actor: { id: input.sellerId, name: sellerName },
      type: 'GOAL_REACHED',
      title: '¡Meta alcanzada! 🎉',
      body: `${sellerName} alcanzó su meta de ${monthName} (${formatMoney(goal.goalAmount)}) con ${formatMoney(total)} vendidos.`,
      url: '/sales/goals',
    });
  } catch (error) {
    console.error('Goal check error:', error);
  }
}
