'use client';

import { useState, useEffect } from 'react';
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
import { Bell, X, CheckCheck, Truck, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export function NotificationPanel() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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

  // Fetch on mount and when panel opens
  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0">
        <SheetHeader className="p-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificaciones
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {unreadCount}
                </Badge>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="overflow-y-auto h-[calc(100vh-80px)]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                No hay notificaciones pendientes
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((notification) => {
                const daysRemaining = getDaysRemaining(notification.dueDate);
                const semaphore = getSemaphore(daysRemaining);
                const SemaphoreIcon = semaphore.icon;

                return (
                  <div
                    key={notification.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                    }`}
                    onClick={() => handleClick(notification)}
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
                            className="h-6 w-6 flex-shrink-0 text-gray-400 hover:text-red-500"
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
                          <Truck className="w-3.5 h-3.5 text-gray-400" />
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
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
