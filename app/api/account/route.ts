import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { requireOwner, verifyOwnerPassword } from '@/lib/account-danger';

export const dynamic = 'force-dynamic';

// Elimina la agencia por completo. El borrado en cascada del Tenant arrastra
// usuarios, roles, catalogos, ventas, bancos, bitacora, etc.
export async function DELETE(request: NextRequest) {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
    const { user } = owner;

    const body = await request.json().catch(() => ({}));
    const tenant = await prismaBase.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true },
    });
    if (!tenant) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 });

    if (typeof body.confirmName !== 'string' || body.confirmName.trim() !== tenant.name.trim()) {
      return NextResponse.json(
        { error: 'Escribe el nombre exacto de la agencia para confirmar' },
        { status: 400 }
      );
    }

    const passwordError = await verifyOwnerPassword(user.id, body.password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    // Relaciones con onDelete: Restrict (SupplierPayment -> BankAccount,
    // Booking -> Destination / PackageDeparture): se borran antes para que la
    // cascada del Tenant no falle segun el orden en que la aplique Postgres.
    await prismaBase.$transaction([
      prismaBase.supplierPayment.deleteMany({ where: { tenantId: user.tenantId } }),
      prismaBase.booking.deleteMany({ where: { tenantId: user.tenantId } }),
      prismaBase.tenant.delete({ where: { id: user.tenantId } }),
    ]);
    console.warn(`Tenant ${user.tenantId} (${tenant.name}) deleted by owner ${user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Error al eliminar la agencia' }, { status: 500 });
  }
}
