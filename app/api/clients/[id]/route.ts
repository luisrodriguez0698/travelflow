import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const clientId = params?.id;

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Error al cargar cliente' }, { status: 500 });
  }
}

async function updateClient(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const clientId = params?.id;
    const body = await request.json();

    const { fullName, ine, passport, curp, phone, email, birthDate } = body;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    const client = await prisma.client.updateMany({
      where: {
        id: clientId,
        tenantId,
      },
      data: {
        fullName,
        ine: ine || null,
        passport: passport || null,
        curp: curp || null,
        phone,
        email: email || null,
        birthDate: birthDate ? new Date(birthDate) : null,
      },
    });

    if (client.count === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Audit log
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'UPDATE',
        entity: 'clients',
        entityId: clientId,
        changes: { fullName, phone, email },
      });
    }

    return NextResponse.json({ message: 'Cliente actualizado' });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return updateClient(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return updateClient(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const clientId = params?.id;

    // Check if client has bookings
    const bookings = await prisma.booking.findFirst({
      where: {
        clientId,
        tenantId,
      },
    });

    if (bookings) {
      return NextResponse.json(
        { error: 'No se puede eliminar un cliente con ventas registradas' },
        { status: 400 }
      );
    }

    const result = await prisma.client.deleteMany({
      where: {
        id: clientId,
        tenantId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Audit log
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'DELETE',
        entity: 'clients',
        entityId: clientId,
        changes: { deleted: true },
      });
    }

    return NextResponse.json({ message: 'Cliente eliminado' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}
