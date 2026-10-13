import { NextResponse } from 'next/server';
import { PING_SIGNATURE } from '@/lib/custom-domain';

export const dynamic = 'force-dynamic';

/** Responde la firma del sistema: sirve para verificar que un dominio propio apunta aqui. */
export function GET() {
  return NextResponse.json({ app: PING_SIGNATURE }, { headers: { 'Cache-Control': 'no-store' } });
}
