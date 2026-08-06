import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Only proxy known image hosts to avoid turning this into an open SSRF relay
function getAllowedHosts(): string[] {
  const hosts = ['gsxw2i31kz.ufs.sh'];
  for (const envVar of [process.env.R2_PUBLIC_URL, process.env.AWS_ENDPOINT_URL]) {
    if (!envVar) continue;
    try {
      hosts.push(new URL(envVar).host);
    } catch {
      // ignore malformed env value
    }
  }
  return hosts;
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('url');
  if (!src) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (!getAllowedHosts().includes(target.host)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  const res = await fetch(target.toString());
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
