import { NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requireTenantId();

    // Auto-generate notifications for upcoming supplier deadlines (next 7 days + overdue)
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Find bookings with supplier deadlines in range that don't have notifications yet
    const bookingsWithDeadlines = await prisma.booking.findMany({
      where: {
        tenantId,
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
      .filter((b) => b.notifications.length === 0 && b.supplierDeadline)
      .map((b) => ({
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
