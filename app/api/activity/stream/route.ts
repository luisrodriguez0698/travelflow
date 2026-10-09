import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { subscribe, registerConnection, unregisterConnection, onlineUsers } from '@/lib/realtime';

// Server-Sent Events: UNA conexion por pestaña por la que el servidor empuja
// todo lo que pasa en tiempo real: avisos, cambios de datos, presencia, quien
// edita que y eventos de sesion. Sin polling.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 25_000; // evita que proxies (Railway) corten la conexion inactiva

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, avatar: true } });
  const me = { id: user.id, name: profile?.name || profile?.email || user.name, avatar: profile?.avatar ?? null };

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // el cliente ya cerro
        }
      };
      const sendEvent = (event: string, data: unknown) => send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      // El cliente reintenta a los 5 s si se cae la conexion
      send('retry: 5000\n\n');
      sendEvent('ready', {});

      const unsubscribe = subscribe(user.id, user.tenantId, (msg) => sendEvent(msg.event, msg.data));
      const connId = registerConnection({ ...me, tenantId: user.tenantId });
      // Foto inicial de quien esta conectado (incluye a este usuario)
      sendEvent('presence', { online: onlineUsers(user.tenantId) });

      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        unregisterConnection(connId);
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
