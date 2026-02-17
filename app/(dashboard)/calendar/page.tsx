'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Hotel,
  CalendarDays,
  DollarSign,
  Plane,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────

interface CalendarEvent {
  id: string;
  clientName: string;
  destinationName: string;
  hotelName: string | null;
  departureDate: string;
  returnDate: string;
  totalPrice: number;
  paymentType: string;
  hasPendingPayments: boolean;
  pendingCount: number;
  totalPayments: number;
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

// ─── Page ────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      const res = await fetch(`/api/sales/calendar?${params}`);
      if (res.ok) {
        setEvents(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [currentDate]);

  // Map events to days
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!event.departureDate || !event.returnDate) continue;
      const start = startOfDay(new Date(event.departureDate));
      const end = startOfDay(new Date(event.returnDate));
      let current = start;
      while (current <= end) {
        const key = format(current, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(event);
        current = addDays(current, 1);
      }
    }
    return map;
  }, [events]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: es });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Calendario de Viajes
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualiza los viajes de tus clientes por fecha
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold capitalize ml-2">
              {monthLabel}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Hoy
            </Button>
            {/* Legend */}
            <div className="hidden md:flex items-center gap-3 ml-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-muted-foreground">Viaje realizado</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-500" />
                <span className="text-muted-foreground">Pagos pendientes</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-blue-500" />
                <span className="text-muted-foreground">Viaje por realizar</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <TooltipProvider delayDuration={200}>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDay.get(dayKey) || [];
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const maxVisible = 3;
                const visibleEvents = dayEvents.slice(0, maxVisible);
                const overflowCount = dayEvents.length - maxVisible;

                return (
                  <div
                    key={index}
                    className={`min-h-[100px] md:min-h-[120px] border-r border-b last:border-r-0 p-1 ${
                      !inMonth ? 'bg-muted/30' : ''
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between px-1">
                      <span
                        className={`text-xs font-medium leading-6 ${
                          today
                            ? 'bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center'
                            : !inMonth
                            ? 'text-muted-foreground/40'
                            : 'text-foreground'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Events */}
                    <div className="mt-0.5 space-y-0.5">
                      {visibleEvents.map((event) => (
                        <EventChip
                          key={event.id}
                          event={event}
                          day={day}
                          onClick={() => router.push(`/sales/${event.id}`)}
                        />
                      ))}
                      {overflowCount > 0 && (
                        <div className="text-[10px] text-muted-foreground px-1 font-medium">
                          +{overflowCount} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </Card>
      )}

      {/* Mobile Legend */}
      <div className="md:hidden">
        <Card className="p-3">
          <div className="flex items-center justify-around text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>Realizado</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              <span>Pagos pendientes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-blue-500" />
              <span>Por realizar</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Event Chip ──────────────────────────────────────

function EventChip({
  event,
  day,
  onClick,
}: {
  event: CalendarEvent;
  day: Date;
  onClick: () => void;
}) {
  const now = new Date();
  const returnDate = new Date(event.returnDate);
  const departureDate = new Date(event.departureDate);

  // Color logic
  let colorClass: string;
  if (returnDate < now) {
    colorClass = 'bg-emerald-500 hover:bg-emerald-600 text-white';
  } else if (event.hasPendingPayments) {
    colorClass = 'bg-red-500 hover:bg-red-600 text-white';
  } else {
    colorClass = 'bg-blue-500 hover:bg-blue-600 text-white';
  }

  const isStart = format(day, 'yyyy-MM-dd') === format(departureDate, 'yyyy-MM-dd');
  const isEnd = format(day, 'yyyy-MM-dd') === format(returnDate, 'yyyy-MM-dd');

  const formattedDeparture = format(departureDate, "d 'de' MMM, yyyy", { locale: es });
  const formattedReturn = format(returnDate, "d 'de' MMM, yyyy", { locale: es });

  const paymentStatus = event.paymentType === 'CASH'
    ? 'Contado - Liquidado'
    : event.hasPendingPayments
    ? `${event.pendingCount} pago${event.pendingCount > 1 ? 's' : ''} pendiente${event.pendingCount > 1 ? 's' : ''}`
    : 'Liquidado';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] md:text-[11px] font-medium truncate cursor-pointer transition-colors ${colorClass}`}
        >
          {event.clientName}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[250px] p-3 space-y-1.5">
        <p className="font-semibold text-sm">{event.clientName}</p>
        {event.destinationName && (
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
            <span>{event.destinationName}</span>
          </div>
        )}
        {event.hotelName && (
          <div className="flex items-center gap-1.5 text-xs">
            <Hotel className="w-3 h-3 text-blue-500 shrink-0" />
            <span>{event.hotelName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs">
          <Plane className="w-3 h-3 text-emerald-500 shrink-0" />
          <span>Salida: {formattedDeparture}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Plane className="w-3 h-3 text-red-500 shrink-0 rotate-180" />
          <span>Regreso: {formattedReturn}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <DollarSign className="w-3 h-3 text-yellow-500 shrink-0" />
          <span>{formatCurrency(event.totalPrice)}</span>
        </div>
        <div className={`text-xs font-medium mt-1 ${
          event.hasPendingPayments ? 'text-red-500' : 'text-emerald-500'
        }`}>
          {paymentStatus}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Click para ver detalle de venta
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
