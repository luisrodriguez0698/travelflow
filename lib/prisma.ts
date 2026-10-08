import { PrismaClient } from '@prisma/client';
import { withAudit } from './audit-extension';

function createClients() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return { base, prisma: withAudit(base) };
}

const globalForPrisma = globalThis as unknown as { prismaClients: ReturnType<typeof createClients> };

const clients = globalForPrisma.prismaClients ?? createClients();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaClients = clients;

export const prisma = clients.prisma;

/**
 * Cliente SIN bitacora automatica. Solo para operaciones masivas de
 * mantenimiento (restablecer/eliminar la agencia), que registran un unico
 * evento en lugar de uno por cada fila borrada.
 */
export const prismaBase = clients.base;
