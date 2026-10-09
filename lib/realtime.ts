import { EventEmitter } from 'events';

// Canal en memoria para avisos en tiempo real (SSE). Vive en el proceso del
// servidor: con UNA instancia (como hoy en Railway) llega a todos al instante.
// Si algun dia hay varias replicas, cambiar este bus por Redis pub/sub o
// Postgres LISTEN/NOTIFY; el resto del codigo no cambia.

const globalForBus = globalThis as unknown as { __travelflowBus?: EventEmitter };

const bus = globalForBus.__travelflowBus ?? new EventEmitter();
bus.setMaxListeners(0); // una conexion SSE por pestaña abierta
globalForBus.__travelflowBus = bus;

const channel = (userId: string) => `user:${userId}`;

export function publishToUser(userId: string, payload: unknown) {
  bus.emit(channel(userId), payload);
}

export function subscribeToUser(userId: string, listener: (payload: unknown) => void): () => void {
  bus.on(channel(userId), listener);
  return () => bus.off(channel(userId), listener);
}
