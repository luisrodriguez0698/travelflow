import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { guestPhoneError, newGuestToken, phoneKey, publishEventChange } from '@/lib/special-events';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const bodySchema = z.object({
  supplierId: z.string().optional().nullable().transform((v) => v || null),
  guests: z
    .array(z.object({ name: z.string().trim().min(2, 'Escribe el nombre de cada invitado').max(120), phone: z.string().trim() }))
    .min(1, 'Agrega al menos un invitado')
    .max(50, 'Máximo 50 invitados a la vez'),
});

/** Agrega varios invitados de un proveedor (o sin proveedor). */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos', 'create');
    const { id } = await params;
    const event = await prisma.specialEvent.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const { supplierId, guests } = parsed.data;

    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: access.tenantId }, select: { id: true } });
      if (!supplier) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 });
    }

    // Telefonos completos, sin repetirse entre si ni con los ya invitados
    const keys = new Set<string>();
    for (const g of guests) {
      const error = guestPhoneError(g.phone);
      if (error) return NextResponse.json({ error: `${g.name}: ${error}` }, { status: 400 });
      const key = phoneKey(g.phone);
      if (keys.has(key)) return NextResponse.json({ error: `El teléfono de ${g.name} está repetido en la lista` }, { status: 400 });
      keys.add(key);
    }
    const existing = await prisma.eventGuest.findFirst({
      where: { eventId: id, phoneKey: { in: [...keys] } },
      select: { name: true, supplier: { select: { name: true } } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Ese teléfono ya está invitado: ${existing.name}${existing.supplier ? ` (${existing.supplier.name})` : ''}` },
        { status: 400 }
      );
    }

    // Uno por uno (no createMany) para que cada alta quede en la bitacora
    for (const g of guests) {
      await prisma.eventGuest.create({
        data: {
          tenantId: access.tenantId,
          eventId: id,
          supplierId,
          name: g.name,
          phone: g.phone,
          phoneKey: phoneKey(g.phone),
          token: newGuestToken(),
          createdBy: access.userId,
        },
      });
    }
    publishEventChange(access.tenantId, id, access.userId);
    return NextResponse.json({ success: true, count: guests.length }, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error adding event guests:', error);
    return NextResponse.json({ error: 'Error al agregar los invitados' }, { status: 500 });
  }
}
