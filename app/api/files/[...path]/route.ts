import { NextRequest, NextResponse } from 'next/server';
import { getFileUrl } from '@/lib/s3';

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
