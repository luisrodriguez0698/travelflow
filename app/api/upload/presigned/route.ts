import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { generatePresignedUploadUrl } from '@/lib/s3';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm',
]);

// Carpetas válidas por contexto — evita path traversal
const VALID_FOLDERS = new Set(['hotels', 'packages', 'logos', 'uploads', 'general']);

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { fileName, contentType, folder } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'fileName and contentType are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Formatos aceptados: imágenes, PDF y video.' },
        { status: 400 }
      );
    }

    const safeFolder = VALID_FOLDERS.has(folder) ? folder : 'uploads';
    const timestamp = Date.now();
    // Sanitizar nombre: solo letras, números, guiones, puntos
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cloudPath = `tenants/${tenantId}/${safeFolder}/${timestamp}-${safeName}`;

    const { uploadUrl, cloud_storage_path, publicUrl } = await generatePresignedUploadUrl(
      fileName,
      contentType,
      cloudPath
    );

    return NextResponse.json({ uploadUrl, cloud_storage_path, publicUrl });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Error generating upload URL' },
      { status: 500 }
    );
  }
}
