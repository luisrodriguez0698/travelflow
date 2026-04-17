import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hostname: string }> }
) {
  const { hostname } = await params;
  const base = `https://${hostname}`;

  const txt = `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`;

  return new NextResponse(txt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
