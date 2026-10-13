import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { listCollections } from '@/lib/sale-collections';

export const dynamic = 'force-dynamic';

/** Cobros registrados de la venta (anticipo/contado/abonos) con sus pagos a proveedores. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess('ventas');
    const { id } = await params;
    const booking = await prisma.booking.findFirst({ where: { id, ...access.bookingScope, type: 'SALE' }, select: { id: true } });
    if (!booking) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    return NextResponse.json(await listCollections(id, access.tenantId));
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading collections:', error);
    return NextResponse.json({ error: 'Error al cargar los cobros' }, { status: 500 });
  }
}
