import { NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';

// Salud del servicio para el indicador de conexion: responde rapido y comprueba
// tambien la base de datos (si la base falla, la app no sirve aunque el servidor viva).
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  try {
    await prismaBase.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({ ok: false, reason: 'database' }, { status: 503, headers: NO_STORE });
  }
}
