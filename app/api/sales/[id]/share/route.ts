import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { newShareToken, pinFromPhone } from '@/lib/client-portal';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/** Direccion publica del link: dominio de la agencia si tiene, si no el del sistema. */
function portalUrl(request: NextRequest, token: string, customDomain: string | null) {
  const base = customDomain
    ? `https://${customDomain}`
    : (process.env.NEXTAUTH_URL || request.nextUrl.origin).replace(/\/$/, '');
  return `${base}/v/${token}`;
}

async function loadBooking(id: string, scope: object) {
  return prisma.booking.findFirst({
    where: { id, ...scope, type: 'SALE' },
    select: {
      id: true,
      shareToken: true,
      shareEnabled: true,
      sharePinRequired: true,
      shareViews: true,
      shareLastViewedAt: true,
      client: { select: { phone: true, fullName: true } },
      tenant: { select: { customDomain: true } },
    },
  });
}

function view(request: NextRequest, b: NonNullable<Awaited<ReturnType<typeof loadBooking>>>) {
  const pin = pinFromPhone(b.client.phone);
  return {
    enabled: b.shareEnabled && !!b.shareToken,
    url: b.shareToken ? portalUrl(request, b.shareToken, b.tenant.customDomain) : null,
    pinRequired: b.sharePinRequired && !!pin,
    pinAvailable: !!pin,
    pinHint: pin ? `••${pin.slice(-2)}` : null,
    clientPhone: b.client.phone,
    clientName: b.client.fullName,
    views: b.shareViews,
    lastViewedAt: b.shareLastViewedAt,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('ventas');
    const { id } = await params;
    const b = await loadBooking(id, access.bookingScope);
    if (!b) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    return NextResponse.json(view(request, b));
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading share link:', error);
    return NextResponse.json({ error: 'Error al cargar el link' }, { status: 500 });
  }
}

/**
 * body.action: 'enable' | 'disable' | 'regenerate' | 'pin'
 * (pin: body.pinRequired true/false)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('ventas', 'edit');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const b = await loadBooking(id, access.bookingScope);
    if (!b) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });

    let data: Record<string, unknown> = {};
    switch (body.action) {
      case 'enable':
        data = { shareEnabled: true, shareToken: b.shareToken ?? newShareToken() };
        break;
      case 'disable':
        data = { shareEnabled: false };
        break;
      case 'regenerate':
        // El link anterior deja de funcionar de inmediato
        data = { shareEnabled: true, shareToken: newShareToken(), shareViews: 0, shareLastViewedAt: null };
        break;
      case 'pin':
        data = { sharePinRequired: body.pinRequired !== false };
        break;
      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
    await prisma.booking.update({ where: { id }, data });
    const updated = await loadBooking(id, access.bookingScope);
    return NextResponse.json(view(request, updated!));
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating share link:', error);
    return NextResponse.json({ error: 'Error al actualizar el link' }, { status: 500 });
  }
}
