import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { deleteFile } from '@/lib/s3';

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    // Extraer la clave R2 quitando el prefijo del dominio público
    const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

    let key: string;
    if (url.startsWith('http') && base) {
      if (!url.startsWith(base)) {
        return NextResponse.json({ error: 'URL no pertenece a este bucket' }, { status: 400 });
      }
      key = url.slice(base.length + 1); // quita "base/"
    } else {
      // path relativo directo
      key = url;
    }

    // Verificar que la clave pertenece al tenant autenticado
    if (!key.startsWith(`tenants/${tenantId}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteFile(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting upload:', error);
    return NextResponse.json({ error: 'Error al eliminar el archivo' }, { status: 500 });
  }
}
