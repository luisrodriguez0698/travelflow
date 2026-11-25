import { NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { agentSummaries } from '@/lib/commissions';

export const dynamic = 'force-dynamic';

/** Resumen por agente + detalle por venta. Con "solo lo mio", solo lo propio. */
export async function GET() {
  try {
    const access = await requireAccess('comisiones');
    const now = new Date();
    const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' })
      .format(now)
      .split('-')
      .map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1, 6));
    const { agents, rows } = await agentSummaries(access, monthStart);
    return NextResponse.json({
      agents,
      rows,
      ownOnly: access.ownOnly,
      // Configurar y pagar es del admin: con "solo lo mio" nunca (no se aprueba a si mismo)
      canEdit: !access.ownOnly && access.can('comisiones', 'edit'),
      canPay: !access.ownOnly && access.can('comisiones', 'payments'),
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading commissions:', error);
    return NextResponse.json({ error: 'No se pudieron cargar las comisiones' }, { status: 500 });
  }
}
