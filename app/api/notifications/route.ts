import { NextResponse } from 'next/server';
import { getAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Avisos de fecha limite con proveedor: los ven quienes manejan ventas o proveedores
    const access = await getAccess(['ventas', 'proveedores']);
    if (!access) return NextResponse.json([]);
    const tenantId = access.tenantId;

    // Auto-generate notifications for upcoming supplier deadlines (next 7 days + overdue)
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Find bookings with supplier deadlines in range that don't have notifications yet
    const bookingsWithDeadlines = await prisma.booking.findMany({
      where: {
        ...access.bookingScope,
        type: 'SALE',
        supplierDeadline: { lte: sevenDaysFromNow },
        status: { not: 'CANCELLED' },
        supplierId: { not: null },
      },
      include: {
        client: true,
        destination: true,
        supplier: true,
        notifications: {
          where: { type: 'SUPPLIER_DEADLINE' },
        },
      },
    });

    // Create notifications for bookings that don't have one yet
    const newNotifications = bookingsWithDeadlines
      .filter((b: typeof bookingsWithDeadlines[number]) => b.notifications.length === 0 && b.supplierDeadline)
      .map((b: typeof bookingsWithDeadlines[number]) => ({
        tenantId,
        bookingId: b.id,
        type: 'SUPPLIER_DEADLINE',
        message: `Fecha límite proveedor ${b.supplier?.name || ''} - ${b.client?.fullName || ''} (${b.destination?.name || ''})`,
        dueDate: b.supplierDeadline!,
      }));

    if (newNotifications.length > 0) {
      await prisma.notification.createMany({ data: newNotifications });
    }

    // Fetch all non-dismissed notifications
    const notifications = await prisma.notification.findMany({
      where: {
        tenantId,
        dismissed: false,
        // Con "solo lo mio": solo avisos de sus propias ventas
        ...(access.ownOnly && { booking: { createdBy: access.userId } }),
      },
      include: {
        booking: {
          include: {
            client: true,
            destination: true,
            supplier: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Error fetching notifications' }, { status: 500 });
  }
}
