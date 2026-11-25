import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { dayToDate, paySettingSchema } from '@/lib/commissions';

export const dynamic = 'force-dynamic';

/** Crea o actualiza el sueldo y la regla de comision de un agente. */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireAccess('comisiones', 'edit');
    if (access.ownOnly) return NextResponse.json({ error: 'No puedes configurar comisiones' }, { status: 403 });
    const parsed = paySettingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const { userId, startDate, notes, ...rest } = parsed.data;

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId: access.tenantId, deletedAt: null }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const data = { ...rest, startDate: dayToDate(startDate), notes: notes?.trim() || null, updatedBy: access.userId };
    const existing = await prisma.agentPaySetting.findUnique({ where: { tenantId_userId: { tenantId: access.tenantId, userId } } });
    const setting = existing
      ? await prisma.agentPaySetting.update({ where: { id: existing.id }, data })
      : await prisma.agentPaySetting.create({ data: { ...data, tenantId: access.tenantId, userId, createdBy: access.userId } });
    return NextResponse.json(setting);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error saving pay setting:', error);
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}
