import { prisma } from '@/lib/prisma';

interface AuditParams {
  tenantId: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId: string;
  changes: Record<string, any>;
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}
