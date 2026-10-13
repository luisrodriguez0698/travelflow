import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { bookingSupplierDebts } from '@/lib/supplier-allocation';

export const dynamic = 'force-dynamic';

/** Lo que se le debe a cada proveedor de una venta/cotizacion (para repartir un cobro). */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess(['ventas', 'cotizaciones']);
    const { id } = await params;
    const booking = await prisma.booking.findFirst({ where: { id, ...access.bookingScope }, select: { id: true } });
    if (!booking) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    // Sin permiso de pagar proveedores no se ofrece repartir
    if (!access.can('proveedores', 'payments')) return NextResponse.json([]);
    return NextResponse.json(await bookingSupplierDebts(id, access.tenantId));
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading supplier debts:', error);
    return NextResponse.json({ error: 'Error al cargar proveedores' }, { status: 500 });
  }
}
