import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/get-tenant';
import { subscribeToUser } from '@/lib/realtime';

// Server-Sent Events: conexion abierta por la que el servidor empuja los
// avisos de actividad del usuario en cuanto ocurren (sin polling).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 25_000; // evita que proxies (Railway) corten la conexion inactiva

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // el cliente ya cerro
        }
      };

      // El cliente reintenta a los 5 s si se cae la conexion
      send('retry: 5000\n\n');
      send('event: ready\ndata: {}\n\n');

      const unsubscribe = subscribeToUser(user.id, (payload) => {
        send(`event: activity\ndata: ${JSON.stringify(payload)}\n\n`);
      });
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };
      request.signal.addEventListener('abort', () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform: impide que la compresion gzip retenga los eventos en buffer
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
