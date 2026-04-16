import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requirePermission('landing');
    const testimonials = await prisma.testimonial.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(testimonials);
  } catch {
    return NextResponse.json({ error: 'Error fetching testimonials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requirePermission('landing');
    const { name, text, rating, source, avatarUrl } = await request.json();

    if (!name?.trim() || !text?.trim()) {
      return NextResponse.json({ error: 'Nombre y texto son requeridos' }, { status: 400 });
    }

    const testimonial = await prisma.testimonial.create({
      data: {
        tenantId,
        name: name.trim(),
        text: text.trim(),
        rating: Number(rating) || 5,
        source: source === 'facebook' ? 'facebook' : 'google',
        avatarUrl: avatarUrl?.trim() || null,
      },
    });

    return NextResponse.json(testimonial, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error creating testimonial' }, { status: 500 });
  }
}
