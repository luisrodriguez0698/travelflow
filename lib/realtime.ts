import { EventEmitter } from 'events';

// Tiempo real en memoria (SSE). Vive en el proceso del servidor: con UNA
// instancia (como hoy en Railway) llega a todos al instante. Si algun dia hay
// varias replicas, cambiar este modulo por Redis pub/sub o Postgres
// LISTEN/NOTIFY; la interfaz publica no cambia.
//
// Canales:
//   user:<id>     -> eventos para una persona (avisos, sesion, celebraciones)
//   tenant:<id>   -> eventos para toda la agencia (cambios de datos, presencia)

export interface RealtimeMessage {
  event: string;
  data: unknown;
}

export interface PresenceUser {
  id: string;
  name: string;
  avatar: string | null;
}

interface Connection extends PresenceUser {
  tenantId: string;
}

interface RealtimeState {
  bus: EventEmitter;
  connections: Map<string, Connection>; // connId -> conexion
  editing: Map<string, Map<string, PresenceUser>>; // "<tenant>:<recurso>" -> usuarios
  seq: number;
}

const globalForRealtime = globalThis as unknown as { __travelflowRealtime?: RealtimeState };

const state: RealtimeState =
  globalForRealtime.__travelflowRealtime ??
  ({ bus: new EventEmitter(), connections: new Map(), editing: new Map(), seq: 0 } as RealtimeState);
state.bus.setMaxListeners(0); // una suscripcion por pestaña abierta
globalForRealtime.__travelflowRealtime = state;

const userChannel = (userId: string) => `user:${userId}`;
const tenantChannel = (tenantId: string) => `tenant:${tenantId}`;

// ─── Publicar / suscribir ────────────────────────────────────────────────────

export function publishToUser(userId: string, event: string, data: unknown) {
  state.bus.emit(userChannel(userId), { event, data } satisfies RealtimeMessage);
}

export function publishToTenant(tenantId: string, event: string, data: unknown) {
  state.bus.emit(tenantChannel(tenantId), { event, data } satisfies RealtimeMessage);
}

export function subscribe(userId: string, tenantId: string, listener: (msg: RealtimeMessage) => void): () => void {
  state.bus.on(userChannel(userId), listener);
  state.bus.on(tenantChannel(tenantId), listener);
  return () => {
    state.bus.off(userChannel(userId), listener);
    state.bus.off(tenantChannel(tenantId), listener);
  };
}

// ─── Presencia: quien esta conectado ─────────────────────────────────────────

export function onlineUsers(tenantId: string): PresenceUser[] {
  const byId = new Map<string, PresenceUser>();
  for (const c of state.connections.values()) {
    if (c.tenantId === tenantId) byId.set(c.id, { id: c.id, name: c.name, avatar: c.avatar });
  }
  return [...byId.values()];
}

function isUserConnected(userId: string): boolean {
  for (const c of state.connections.values()) if (c.id === userId) return true;
  return false;
}

function broadcastPresence(tenantId: string) {
  publishToTenant(tenantId, 'presence', { online: onlineUsers(tenantId) });
}

export function registerConnection(conn: Connection): string {
  const connId = `c${++state.seq}`;
  const wasOnline = isUserConnected(conn.id);
  state.connections.set(connId, conn);
  if (!wasOnline) broadcastPresence(conn.tenantId);
  return connId;
}

export function unregisterConnection(connId: string) {
  const conn = state.connections.get(connId);
  if (!conn) return;
  state.connections.delete(connId);
  if (!isUserConnected(conn.id)) {
    // Ya no tiene ninguna pestaña abierta: sale de "en linea" y de lo que editaba
    broadcastPresence(conn.tenantId);
    for (const [key, users] of state.editing) {
      if (key.startsWith(`${conn.tenantId}:`) && users.delete(conn.id)) {
        broadcastEditing(conn.tenantId, key.slice(conn.tenantId.length + 1));
      }
    }
  }
}

// ─── "Fulano esta editando esta venta" ───────────────────────────────────────

function broadcastEditing(tenantId: string, resource: string) {
  const key = `${tenantId}:${resource}`;
  const users = [...(state.editing.get(key)?.values() ?? [])];
  if (users.length === 0) state.editing.delete(key);
  publishToTenant(tenantId, 'editing', { resource, users });
}

export function setEditing(tenantId: string, resource: string, user: PresenceUser, active: boolean) {
  const key = `${tenantId}:${resource}`;
  const users = state.editing.get(key) ?? new Map<string, PresenceUser>();
  if (active) users.set(user.id, user);
  else users.delete(user.id);
  state.editing.set(key, users);
  broadcastEditing(tenantId, resource);
}

export function editorsOf(tenantId: string, resource: string): PresenceUser[] {
  return [...(state.editing.get(`${tenantId}:${resource}`)?.values() ?? [])];
}
