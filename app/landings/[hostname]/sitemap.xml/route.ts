import { NextRequest, NextResponse } from 'next/server';

// ── Configuración de tenants ──────────────────────────────────────────────────
// Para agregar un nuevo tenant, añade una entrada al objeto con su hostname.
const TENANT_CONFIGS: Record<string, { changeFrequency: string; priority: number }> = {
  'viajaentrenubes.com': { changeFrequency: 'monthly', priority: 1 },
  // 'otraagencia.com': { changeFrequency: 'monthly', priority: 1 },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hostname: string }> }
) {
  const { hostname } = await params;
  const config = TENANT_CONFIGS[hostname] ?? { changeFrequency: 'monthly', priority: 1 };
  const base = `https://${hostname}`;
  const now = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${config.changeFrequency}</changefreq>
    <priority>${config.priority.toFixed(1)}</priority>
  </url>
  <url>
    <loc>${base}/#destinos</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${config.changeFrequency}</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${base}/#nosotros</loc>
    <lastmod>${now}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${base}/#contacto</loc>
    <lastmod>${now}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
