import { NextRequest, NextResponse } from 'next/server';
import { getFileUrl, deleteFile } from '@/lib/s3';
import { requireTenantId } from '@/lib/get-tenant';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = await params;
    const cloudStoragePath = path.join('/');

    if (!cloudStoragePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Check if it's a public file
    const isPublic = cloudStoragePath.includes('/public/');
    const url = await getFileUrl(cloudStoragePath, isPublic);

    // Redirect to the actual file URL
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const tenantId = await requireTenantId();
    const { path } = await params;
    const cloudStoragePath = path.join('/');

    if (!cloudStoragePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Verificar que el archivo pertenece al tenant autenticado
    if (!cloudStoragePath.startsWith(`tenants/${tenantId}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteFile(cloudStoragePath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Error deleting file' }, { status: 500 });
  }
}
