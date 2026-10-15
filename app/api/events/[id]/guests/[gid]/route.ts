import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { guestPhoneError, guestSchema, phoneKey, publishEventChange } from '@/lib/special-events';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string; gid: string } };

async function findGuest(tenantId: string, eventId: string, guestId: string) {
  return prisma.eventGuest.findFirst({ where: { id: guestId, eventId, tenantId }, select: { id: true, phoneKey: true } });
}

/** Editar nombre, telefono o proveedor. */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos', 'edit');
    const { id, gid } = await params;
    const guest = await findGuest(access.tenantId, id, gid);
    if (!guest) return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });

    const parsed = guestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const { name, phone, supplierId } = parsed.data;

    const phoneErr = guestPhoneError(phone);
    if (phoneErr) return NextResponse.json({ error: phoneErr }, { status: 400 });
    const key = phoneKey(phone);
    if (key !== guest.phoneKey) {
      const dup = await prisma.eventGuest.findFirst({ where: { eventId: id, phoneKey: key, id: { not: gid } }, select: { name: true } });
      if (dup) return NextResponse.json({ error: `Ese teléfono ya está invitado: ${dup.name}` }, { status: 400 });
    }
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: access.tenantId }, select: { id: true } });
      if (!supplier) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 });
    }

    const updated = await prisma.eventGuest.update({ where: { id: gid }, data: { name, phone, phoneKey: key, supplierId } });
    publishEventChange(access.tenantId, id, access.userId);
    return NextResponse.json(updated);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating guest:', error);
    return NextResponse.json({ error: 'Error al actualizar el invitado' }, { status: 500 });
  }
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sent') }), // se le mando por WhatsApp
  z.object({ action: z.literal('status'), status: z.enum(['PENDING', 'CONFIRMED', 'DECLINED']) }), // respuesta tomada por telefono
  z.object({ action: z.literal('checkin') }), // llegada registrada a mano
  z.object({ action: z.literal('undo-checkin') }),
]);

/** Acciones rapidas sobre un invitado. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos', 'edit');
    const { id, gid } = await params;
    const guest = await findGuest(access.tenantId, id, gid);
    if (!guest) return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    const body = parsed.data;

    const data =
      body.action === 'sent'
        ? { sentAt: new Date() }
        : body.action === 'status'
          ? { status: body.status, respondedAt: body.status === 'PENDING' ? null : new Date() }
          : body.action === 'checkin'
            ? { checkedInAt: new Date(), checkedInBy: access.userId }
            : { checkedInAt: null, checkedInBy: null };

    const updated = await prisma.eventGuest.update({ where: { id: gid }, data });
    publishEventChange(access.tenantId, id, access.userId);
    return NextResponse.json(updated);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating guest:', error);
    return NextResponse.json({ error: 'Error al actualizar el invitado' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos', 'delete');
    const { id, gid } = await params;
    const guest = await findGuest(access.tenantId, id, gid);
    if (!guest) return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });
    await prisma.eventGuest.delete({ where: { id: gid } });
    publishEventChange(access.tenantId, id, access.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting guest:', error);
    return NextResponse.json({ error: 'Error al eliminar el invitado' }, { status: 500 });
  }
}
