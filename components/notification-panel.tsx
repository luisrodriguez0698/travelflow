'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell, X, CheckCheck, Truck, Clock, AlertTriangle, ShoppingCart, Wallet, Landmark, Volume2, VolumeX, Activity, Trophy,
  ReceiptText,
  PartyPopper,
  Trash2,
  Hand,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SwipeRow } from './swipe-row';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { isSoundEnabled, setSoundEnabled, playChime, unlockAudio, SOUND_CHANGE_EVENT } from '@/lib/notify-sound';
import { useRealtimeEvent } from './realtime-provider';
import { RowsSkeleton } from '@/components/skeletons';

// ─── Avisos de proveedores (fechas limite) ───────────

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  dueDate: string;
  createdAt: string;
  booking: {
    id: string;
    totalPrice: number;
    client: { fullName: string } | null;
    destination: { name: string } | null;
    supplier: { name: string; serviceType: string } | null;
  };
}

// ─── Avisos de actividad (ventas, abonos, ingresos) ───

interface ActivityItem {
  id: string;
  type: 'SALE_CREATED' | 'PAYMENT_RECEIVED' | 'BANK_INCOME' | string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  actorName: string;
  createdAt: string;
}

const ACTIVITY_STYLE: Record<string, { icon: typeof ShoppingCart; className: string }> = {
  SALE_CREATED: { icon: ShoppingCart, className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  PAYMENT_RECEIVED: { icon: Wallet, className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  BANK_INCOME: { icon: Landmark, className: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' },
  GOAL_REACHED: { icon: Trophy, className: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  FIXED_EXPENSE: { icon: ReceiptText, className: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' },
  EVENT_RSVP: { icon: PartyPopper, className: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40 dark:text-fuchsia-400' },
};

function relativeTime(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return format(new Date(date), "d 'de' MMM, HH:mm", { locale: es });
}

function getDaysRemaining(dueDate: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getSemaphore(daysRemaining: number) {
  if (daysRemaining < 0) {
    return { color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800', label: 'Vencida', icon: AlertTriangle };
  }
  if (daysRemaining <= 2) {
    return { color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800', label: 'Urgente', icon: AlertTriangle };
  }
  if (daysRemaining <= 4) {
    return { color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', label: 'Próxima', icon: Clock };
  }
  return { color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800', label: 'Próxima', icon: Clock };
}

const HINT_KEY = 'tf-swipe-hint-seen';

/** Pista de una sola vez: como deslizar las notificaciones. */
function SwipeHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(HINT_KEY) !== '1');
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {}
  };
  return (
    <div className="flex items-center gap-3 bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground">
      <motion.span animate={{ x: [0, 10, -10, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1 }}>
        <Hand className="h-4 w-4" />
      </motion.span>
      <span className="flex-1">Desliza → para marcar como leída y ← para eliminar.</span>
      <button type="button" onClick={close} className="font-semibold text-foreground">
        Entendido
      </button>
    </div>
  );
}

export function NotificationPanel() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'activity' | 'suppliers'>('activity');

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityUnread, setActivityUnread] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  // Mas reciente ya visto: lo que llegue despues es "nuevo" (sonido + aviso)
  const newestSeen = useRef<string | null>(null);
  // IDs ya mostrados: evita duplicar sonido/aviso entre el stream y la sincronizacion
  const knownIds = useRef(new Set<string>());

  // ─── Proveedores ───
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Actividad: lista completa (al abrir y al (re)conectar el stream) ───
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity');
      if (!res.ok) return;
      const data: { items: ActivityItem[]; unread: number } = await res.json();
      const unseen = new Set(data.items.filter((i) => !knownIds.current.has(i.id)).map((i) => i.id));
      data.items.forEach((i) => knownIds.current.add(i.id));
      setActivity(data.items);
      setActivityUnread(data.unread);

      const newest = data.items[0]?.createdAt ?? null;
      if (newestSeen.current === null) {
        newestSeen.current = newest ?? new Date(0).toISOString(); // primera carga: sin sonido
        return;
      }
      const fresh = data.items.filter((i) => !i.read && unseen.has(i.id) && i.createdAt > (newestSeen.current as string));
      if (newest && newest > newestSeen.current) newestSeen.current = newest;
      if (fresh.length > 0) {
        playChime();
        const latest = fresh[0];
        toast(latest.title, {
          description: fresh.length > 1 ? `${latest.body} (+${fresh.length - 1} más)` : latest.body,
          action: latest.url ? { label: 'Ver', onClick: () => router.push(latest.url as string) } : undefined,
        });
      }
    } catch {
      /* sin red: se reintenta en el siguiente ciclo */
    }
  }, [router]);

  // Aviso que llega en vivo por el stream SSE
  const handleIncoming = useCallback(
    (item: ActivityItem) => {
      if (knownIds.current.has(item.id)) return;
      knownIds.current.add(item.id);
      setActivity((prev) => [item, ...prev.filter((a) => a.id !== item.id)].slice(0, 30));
      setActivityUnread((n) => n + 1);
      if (!newestSeen.current || item.createdAt > newestSeen.current) newestSeen.current = item.createdAt;
      playChime();
      toast(item.title, {
        description: item.body,
        action: item.url ? { label: 'Ver', onClick: () => router.push(item.url as string) } : undefined,
      });
    },
    [router]
  );

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    fetchNotifications();
    fetchActivity();

    // El navegador solo deja sonar despues de una interaccion del usuario
    const unlock = () => unlockAudio();
    // Si se cambia el sonido desde Mi perfil, el icono 🔊/🔇 se actualiza aqui
    const syncSound = () => setSoundOn(isSoundEnabled());
    window.addEventListener(SOUND_CHANGE_EVENT, syncSound);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener(SOUND_CHANGE_EVENT, syncSound);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [fetchActivity]);

  // Tiempo real (conexion SSE compartida): avisos al instante y, al (re)conectar,
  // sincroniza la lista por si llego algo mientras estaba desconectado
  useRealtimeEvent<ActivityItem>('activity', handleIncoming);
  useRealtimeEvent('ready', () => fetchActivity());

  useEffect(() => {
    if (open) {
      fetchNotifications();
      fetchActivity();
    }
  }, [open, fetchActivity]);

  const supplierUnread = notifications.filter((n) => !n.read).length;
  const unreadCount = activityUnread + supplierUnread;

  // Numerito en el icono de la app instalada (PC / iPhone / Android), como WhatsApp
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (unreadCount > 0 ? nav.setAppBadge(unreadCount) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unreadCount]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      unlockAudio();
      playChime(); // muestra como suena
    }
  };

  // ─── Acciones: actividad ───
  const markActivityRead = async (ids: string[] | 'all') => {
    try {
      await fetch('/api/activity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
      });
      setActivity((prev) => prev.map((a) => (ids === 'all' || ids.includes(a.id) ? { ...a, read: true } : a)));
      setActivityUnread((n) => (ids === 'all' ? 0 : Math.max(0, n - ids.length)));
    } catch {}
  };

  const setActivityRead = async (item: ActivityItem, read: boolean) => {
    setActivity((prev) => prev.map((a) => (a.id === item.id ? { ...a, read } : a)));
    setActivityUnread((n) => Math.max(0, n + (read ? -1 : 1)));
    try {
      await fetch('/api/activity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [item.id], read }),
      });
    } catch {}
  };

  const deleteActivity = async (ids: string[] | 'read') => {
    const removed = activity.filter((a) => (ids === 'read' ? a.read : ids.includes(a.id)));
    setActivity((prev) => prev.filter((a) => !removed.some((r) => r.id === a.id)));
    setActivityUnread((n) => Math.max(0, n - removed.filter((r) => !r.read).length));
    try {
      await fetch('/api/activity', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids === 'read' ? { read: true } : { ids }),
      });
    } catch {}
  };

  const handleActivityClick = (item: ActivityItem) => {
    if (!item.read) markActivityRead([item.id]);
    if (item.url) {
      setOpen(false);
      router.push(item.url);
    }
  };

  // ─── Acciones: proveedores ───
  const handleDismiss = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handleMarkRead = async (id: string, read = true) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read } : n))
      );
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read }),
      });
    } catch {}
  };

  const handleMarkAllRead = async () => {
    if (tab === 'activity') {
      await markActivityRead('all');
      return;
    }
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${n.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true }),
        })
      )
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClick = (notification: Notification) => {
    handleMarkRead(notification.id);
    setOpen(false);
    router.push(`/sales/${notification.booking.id}`);
  };

  const tabUnread = tab === 'activity' ? activityUnread : supplierUnread;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[440px] sm:max-w-[440px] p-0 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <SheetHeader className="p-4 pb-3 border-b space-y-3">
          <div className="flex items-center justify-between gap-2 pr-6">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificaciones
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSound}
                title={soundOn ? 'Sonido activado (clic para silenciar)' : 'Sonido desactivado (clic para activar)'}
                aria-label={soundOn ? 'Silenciar avisos' : 'Activar sonido de avisos'}
              >
                {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
              </Button>
              {tab === 'activity' && activity.some((a) => a.read) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => deleteActivity('read')}
                  title="Eliminar las ya leídas"
                  aria-label="Eliminar las ya leídas"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              {tabUnread > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={handleMarkAllRead}>
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Marcar todas
                </Button>
              )}
            </div>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'activity' | 'suppliers')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activity" className="gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Actividad
                {activityUnread > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activityUnread}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                Proveedores
                {supplierUnread > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{supplierUnread}</Badge>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        <div className="overflow-y-auto flex-1">
          {tab === 'activity' ? (
            activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <Activity className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm text-center">Sin actividad reciente</p>
                <p className="text-xs text-muted-foreground text-center mt-1 max-w-[260px]">
                  Aquí verás al momento las ventas, abonos e ingresos que registre tu equipo.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                <SwipeHint />
                <AnimatePresence initial={false}>
                {activity.map((item) => {
                  const style = ACTIVITY_STYLE[item.type] || ACTIVITY_STYLE.SALE_CREATED;
                  const Icon = style.icon;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                    <SwipeRow
                      read={item.read}
                      onToggleRead={() => setActivityRead(item, !item.read)}
                      onDelete={() => deleteActivity([item.id])}
                      onOpen={() => handleActivityClick(item)}
                    >
                    <div
                      className={`w-full text-left p-4 flex gap-3 hover:bg-muted/50 transition-colors ${
                        !item.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${style.className}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm ${!item.read ? 'font-semibold' : 'font-medium'}`}>{item.title}</p>
                          {!item.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-label="No leída" />}
                        </div>
                        <p className="text-sm text-muted-foreground leading-snug mt-0.5">{item.body}</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">{relativeTime(item.createdAt)}</p>
                      </div>
                    </div>
                    </SwipeRow>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            )
          ) : loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RowsSkeleton rows={4} className="px-4" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Bell className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm text-center">
                No hay notificaciones pendientes
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const daysRemaining = getDaysRemaining(notification.dueDate);
                const semaphore = getSemaphore(daysRemaining);
                const SemaphoreIcon = semaphore.icon;

                return (
                  <SwipeRow
                    key={notification.id}
                    read={notification.read}
                    onToggleRead={() => handleMarkRead(notification.id, !notification.read)}
                    onDelete={() => handleDismiss(notification.id)}
                    onOpen={() => handleClick(notification)}
                    hoverActions={false}
                  >
                  <div
                    className={`p-4 hover:bg-muted/50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Semaphore indicator */}
                      <div className={`w-2 rounded-full flex-shrink-0 ${semaphore.color}`} />

                      <div className="flex-1 min-w-0">
                        {/* Client + Destination */}
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${!notification.read ? 'font-semibold' : ''}`}>
                            {notification.booking.client?.fullName || '—'}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-red-500"
                            onClick={(e) => handleDismiss(notification.id, e)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground truncate">
                          {notification.booking.destination?.name || '—'}
                        </p>

                        {/* Supplier */}
                        <div className="flex items-center gap-1 mt-1.5">
                          <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {notification.booking.supplier?.name || '—'}
                          </span>
                        </div>

                        {/* Deadline with semaphore */}
                        <div className={`flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md border ${semaphore.bgColor} ${semaphore.borderColor}`}>
                          <SemaphoreIcon className={`w-3.5 h-3.5 ${semaphore.textColor}`} />
                          <span className={`text-xs font-medium ${semaphore.textColor}`}>
                            {format(new Date(notification.dueDate), "d 'de' MMM, yyyy", { locale: es })}
                            {' — '}
                            {daysRemaining < 0
                              ? `${Math.abs(daysRemaining)} día${Math.abs(daysRemaining) !== 1 ? 's' : ''} vencida`
                              : daysRemaining === 0
                              ? 'Vence hoy'
                              : `${daysRemaining} día${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''}`
                            }
                          </span>
                          <Badge variant="outline" className={`ml-auto text-[10px] px-1.5 py-0 ${semaphore.textColor} ${semaphore.borderColor}`}>
                            {semaphore.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  </SwipeRow>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
