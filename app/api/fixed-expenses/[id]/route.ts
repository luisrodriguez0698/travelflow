import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { fixedExpenseSchema, toFixedExpenseData } from '@/lib/fixed-expenses';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('gastos', 'edit');
    const { id } = await params;
    const existing = await prisma.fixedExpense.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!existing) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

    const parsed = fixedExpenseSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const built = await toFixedExpenseData(access, parsed.data);
    if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 });

    const dueChanged = existing.nextDueDate.getTime() !== built.data.nextDueDate.getTime();
    const expense = await prisma.fixedExpense.update({
      where: { id },
      data: {
        ...built.data,
        // Nueva fecha: los recordatorios empiezan de nuevo
        ...(dueChanged && { lastReminderDue: null, lastReminderStage: null, lastReminderAt: null }),
      },
    });
    return NextResponse.json(expense);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating fixed expense:', error);
    return NextResponse.json({ error: 'Error al actualizar el gasto fijo' }, { status: 500 });
  }
}

/** Pausar / reactivar */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('gastos', 'edit');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const existing = await prisma.fixedExpense.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!existing) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    const expense = await prisma.fixedExpense.update({ where: { id }, data: { isActive: body.isActive === true } });
    return NextResponse.json(expense);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error toggling fixed expense:', error);
    return NextResponse.json({ error: 'Error al actualizar el gasto fijo' }, { status: 500 });
  }
}

/** Elimina el gasto y su historial (los egresos ya registrados en Bancos se conservan). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('gastos', 'delete');
    const { id } = await params;
    const existing = await prisma.fixedExpense.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!existing) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    await prisma.fixedExpense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting fixed expense:', error);
    return NextResponse.json({ error: 'Error al eliminar el gasto fijo' }, { status: 500 });
  }
}
