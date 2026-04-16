import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await requirePermission('landing');
    const { id } = await params;
    const { name, text, rating, source, avatarUrl } = await request.json();

    const existing = await prisma.testimonial.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.testimonial.update({
      where: { id },
      data: {
        name: name.trim(),
        text: text.trim(),
        rating: Number(rating) || 5,
        source: source === 'facebook' ? 'facebook' : 'google',
        avatarUrl: avatarUrl?.trim() || null,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Error updating testimonial' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await requirePermission('landing');
    const { id } = await params;

    const existing = await prisma.testimonial.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.testimonial.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error deleting testimonial' }, { status: 500 });
  }
}
