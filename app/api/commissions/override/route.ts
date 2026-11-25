import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { overrideSchema } from '@/lib/commissions';

export const dynamic = 'force-dynamic';

/** Ajusta la comision de una venta (otro % o un monto fijo). Sin valores = quitar el ajuste. */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireAccess('comisiones', 'edit');
    if (access.ownOnly) return NextResponse.json({ error: 'No puedes ajustar comisiones' }, { status: 403 });
    const parsed = overrideSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const { bookingId, rate, amount, note } = parsed.data;

    const booking = await prisma.booking.findFirst({ where: { id: bookingId, tenantId: access.tenantId, type: 'SALE' }, select: { id: true } });
    if (!booking) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });

    const existing = await prisma.saleCommissionOverride.findUnique({ where: { bookingId } });
    if (rate === null && amount === null) {
      if (existing) await prisma.saleCommissionOverride.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true });
    }
    const data = { rate, amount, note: note?.trim() || null, updatedBy: access.userId };
    const saved = existing
      ? await prisma.saleCommissionOverride.update({ where: { id: existing.id }, data })
      : await prisma.saleCommissionOverride.create({ data: { ...data, tenantId: access.tenantId, bookingId, createdBy: access.userId } });
    return NextResponse.json(saved);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error saving commission override:', error);
    return NextResponse.json({ error: 'No se pudo guardar el ajuste' }, { status: 500 });
  }
}
