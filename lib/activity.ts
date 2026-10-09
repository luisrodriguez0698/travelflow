import { prisma } from './prisma';
import { resolvePermissionList, can, ALL_MODULES } from './permissions';
import { publishToUser } from './realtime';

// Avisos de actividad para el equipo ("nueva venta", "abono", "ingreso").
// Cada evento exige el acceso de su apartado: solo lo recibe quien puede verlo.

export type ActivityType = 'SALE_CREATED' | 'PAYMENT_RECEIVED' | 'BANK_INCOME';

const EVENT_MODULE: Record<ActivityType, string> = {
  SALE_CREATED: 'ventas',
  PAYMENT_RECEIVED: 'ventas',
  BANK_INCOME: 'bancos',
};

/**
 * Roles que reciben avisos por ahora. Para abrirlo a todos los roles (siempre
 * filtrado por acceso), basta con dejar esta lista en null.
 */
const NOTIFY_ROLE_NAMES: string[] | null = ['Admin', 'Contador'];

interface ActivityInput {
  tenantId: string;
  actor: { id: string; name: string };
  type: ActivityType;
  title: string;
  body: string;
  url?: string;
}

export const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

/**
 * Registra el aviso para cada destinatario y manda push. Nunca lanza error:
 * un fallo aqui no debe tumbar la venta o el pago que lo origino.
 */
export async function notifyActivity(input: ActivityInput): Promise<void> {
  try {
    const module = EVENT_MODULE[input.type];
    const users = await prisma.user.findMany({
      where: { tenantId: input.tenantId, deletedAt: null, isActive: true, id: { not: input.actor.id } },
      select: { id: true, role: true, roleRef: { select: { name: true, permissions: true, ownDataOnly: true } } },
    });

    const recipients = users.filter((u) => {
      const roleName = u.roleRef?.name ?? u.role;
      if (NOTIFY_ROLE_NAMES && !NOTIFY_ROLE_NAMES.some((r) => r.toLowerCase() === roleName.toLowerCase())) {
        return false;
      }
      // "Solo lo suyo": no debe enterarse de lo que hacen los demas
      if (u.roleRef?.ownDataOnly) return false;
      const permissions = u.roleRef
        ? resolvePermissionList(u.roleRef.permissions)
        : u.role === 'ADMIN'
          ? resolvePermissionList([...ALL_MODULES])
          : [];
      return can(permissions, module);
    });
    if (recipients.length === 0) return;

    const created = await prisma.activityNotification.createManyAndReturn({
      select: { id: true, userId: true, type: true, title: true, body: true, url: true, read: true, actorName: true, createdAt: true },
      data: recipients.map((u) => ({
        tenantId: input.tenantId,
        userId: u.id,
        actorName: input.actor.name,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url ?? null,
      })),
    });

    // Tiempo real: a cada destinatario conectado por SSE le llega al instante
    for (const { userId, ...item } of created) publishToUser(userId, item);

    // Push al celular/PC aunque la app este cerrada. Import dinamico: web-push
    // falla al cargar si faltan las llaves VAPID y no debe afectar lo demas.
    import('./push')
      .then(({ sendPushToUser }) =>
        Promise.all(
          recipients.map((u) =>
            sendPushToUser(u.id, { title: input.title, body: input.body, url: input.url }).catch(() => {})
          )
        )
      )
      .catch((error) => console.error('Activity push error:', error));
  } catch (error) {
    console.error('Activity notification error:', error);
  }
}
