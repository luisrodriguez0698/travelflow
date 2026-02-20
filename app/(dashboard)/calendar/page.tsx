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
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  subDays,
  format,
  isSameMonth,
  isToday,
  startOfDay,
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

type ViewMode = 'month' | 'week' | 'day';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

// ─── Page ────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let params: URLSearchParams;
      if (viewMode === 'week') {
        const start = startOfWeek(currentDate, { weekStartsOn: 0 });
        const end = endOfWeek(currentDate, { weekStartsOn: 0 });
        params = new URLSearchParams({
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        });
      } else if (viewMode === 'day') {
        params = new URLSearchParams({
          startDate: format(currentDate, 'yyyy-MM-dd'),
          endDate: format(currentDate, 'yyyy-MM-dd'),
        });
      } else {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        params = new URLSearchParams({
          month: String(month),
          year: String(year),
        });
      }
      const res = await fetch(`/api/sales/calendar?${params}`);
      if (res.ok) setEvents(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Map events to days (spread multi-day trips across each day they cover)
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

  // Calendar grid for month view (42 cells)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(weekStart, i));
    return days;
  }, [currentDate]);

  // Week days for week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Navigation
  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  // Period label
  const periodLabel = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: es });
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'd')} – ${format(end, 'd')} de ${format(start, 'MMMM yyyy', { locale: es })}`;
      }
      return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
  }, [currentDate, viewMode]);

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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold capitalize ml-2">{periodLabel}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Hoy
            </Button>
            {/* View mode switcher */}
            <div className="flex rounded-md border overflow-hidden text-sm">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-blue-500 text-white'
                      : 'bg-background hover:bg-muted text-foreground'
                  }`}
                >
                  {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className="hidden lg:flex items-center gap-3 ml-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-muted-foreground">Realizado</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-500" />
                <span className="text-muted-foreground">Pago pendiente</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-blue-500" />
                <span className="text-muted-foreground">Por realizar</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Calendar Views */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {viewMode === 'month' && (
            <MonthView
              calendarDays={calendarDays}
              currentDate={currentDate}
              eventsByDay={eventsByDay}
              onEventClick={(id) => router.push(`/sales/${id}`)}
              onMoreClick={(day) => { setCurrentDate(day); setViewMode('day'); }}
            />
          )}
          {viewMode === 'week' && (
            <WeekView
              weekDays={weekDays}
              eventsByDay={eventsByDay}
              onEventClick={(id) => router.push(`/sales/${id}`)}
            />
          )}
          {viewMode === 'day' && (
            <DayView
              day={currentDate}
              eventsByDay={eventsByDay}
              onEventClick={(id) => router.push(`/sales/${id}`)}
            />
          )}
        </>
      )}

      {/* Mobile Legend */}
      <div className="lg:hidden">
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

// ─── Month View ───────────────────────────────────────

function MonthView({
  calendarDays,
  currentDate,
  eventsByDay,
  onEventClick,
  onMoreClick,
}: {
  calendarDays: Date[];
  currentDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onEventClick: (id: string) => void;
  onMoreClick: (day: Date) => void;
}) {
  return (
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

                <div className="mt-0.5 space-y-0.5">
                  {visibleEvents.map((event) => (
                    <EventChip
                      key={event.id}
                      event={event}
                      day={day}
                      onClick={() => onEventClick(event.id)}
                    />
                  ))}
                  {overflowCount > 0 && (
                    <button
                      onClick={() => onMoreClick(day)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 px-1 font-medium w-full text-left hover:underline"
                    >
                      +{overflowCount} más
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    </Card>
  );
}

// ─── Week View ────────────────────────────────────────

function WeekView({
  weekDays,
  eventsByDay,
  onEventClick,
}: {
  weekDays: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  onEventClick: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <TooltipProvider delayDuration={200}>
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day) => {
            const today = isToday(day);
            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className="border-r last:border-r-0 text-center p-3"
              >
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  {format(day, 'EEE', { locale: es })}
                </div>
                <div
                  className={`text-xl font-bold mt-1 ${
                    today
                      ? 'bg-blue-500 text-white w-9 h-9 rounded-full mx-auto flex items-center justify-center text-base'
                      : 'text-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Events per day */}
        <div className="grid grid-cols-7 min-h-[300px]">
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(dayKey) || [];
            const today = isToday(day);
            return (
              <div
                key={dayKey}
                className={`border-r last:border-r-0 p-1.5 space-y-1 ${
                  today ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''
                }`}
              >
                {dayEvents.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/30 text-center pt-6">—</div>
                ) : (
                  dayEvents.map((event) => (
                    <EventChip
                      key={event.id}
                      event={event}
                      day={day}
                      onClick={() => onEventClick(event.id)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    </Card>
  );
}

// ─── Day View ─────────────────────────────────────────

function DayView({
  day,
  eventsByDay,
  onEventClick,
}: {
  day: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onEventClick: (id: string) => void;
}) {
  const dayKey = format(day, 'yyyy-MM-dd');
  const dayEvents = eventsByDay.get(dayKey) || [];

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold capitalize">
              {format(day, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {dayEvents.length === 0
                ? 'Sin viajes programados'
                : `${dayEvents.length} viaje${dayEvents.length !== 1 ? 's' : ''} activo${dayEvents.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {isToday(day) && (
            <span className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-medium">
              Hoy
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {dayEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No hay viajes programados para este día</p>
          </div>
        ) : (
          dayEvents.map((event) => (
            <DayEventCard
              key={event.id}
              event={event}
              onClick={() => onEventClick(event.id)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

// ─── Day Event Card ───────────────────────────────────

function DayEventCard({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const now = new Date();
  const returnDate = new Date(event.returnDate);
  const departureDate = new Date(event.departureDate);

  let borderColor: string;
  let badgeClass: string;
  let statusLabel: string;

  if (returnDate < now) {
    borderColor = 'border-l-emerald-500';
    badgeClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    statusLabel = 'Regresó';
  } else if (event.hasPendingPayments) {
    borderColor = 'border-l-red-500';
    badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    statusLabel = 'Pago pendiente';
  } else {
    borderColor = 'border-l-blue-500';
    badgeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    statusLabel = 'Viaje activo';
  }

  const paymentInfo =
    event.paymentType === 'CASH'
      ? 'Contado – Liquidado'
      : event.hasPendingPayments
      ? `${event.pendingCount} pago${event.pendingCount > 1 ? 's' : ''} pendiente${event.pendingCount > 1 ? 's' : ''}`
      : 'Liquidado';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border border-l-4 ${borderColor} bg-card hover:bg-muted/40 transition-colors shadow-sm`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{event.clientName}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {event.destinationName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{event.destinationName}</span>
                {event.hotelName && (
                  <span className="text-muted-foreground/60">• {event.hotelName}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Plane className="w-3 h-3 shrink-0" />
              <span>
                {format(departureDate, "d 'de' MMM", { locale: es })}
                {' → '}
                {format(returnDate, "d 'de' MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-sm">{formatCurrency(event.totalPrice)}</p>
          <p
            className={`text-xs mt-0.5 ${
              event.hasPendingPayments ? 'text-red-500' : 'text-emerald-600'
            }`}
          >
            {paymentInfo}
          </p>
        </div>
      </div>
    </button>
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

  let colorClass: string;
  if (returnDate < now) {
    colorClass = 'bg-emerald-500 hover:bg-emerald-600 text-white';
  } else if (event.hasPendingPayments) {
    colorClass = 'bg-red-500 hover:bg-red-600 text-white';
  } else {
    colorClass = 'bg-blue-500 hover:bg-blue-600 text-white';
  }

  const formattedDeparture = format(departureDate, "d 'de' MMM, yyyy", { locale: es });
  const formattedReturn = format(returnDate, "d 'de' MMM, yyyy", { locale: es });

  const paymentStatus =
    event.paymentType === 'CASH'
      ? 'Contado – Liquidado'
      : event.hasPendingPayments
      ? `${event.pendingCount} pago${event.pendingCount > 1 ? 's' : ''} pendiente${event.pendingCount > 1 ? 's' : ''}`
      : 'Liquidado';

  // suppress unused variable warning
  void day;

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
        <div
          className={`text-xs font-medium mt-1 ${
            event.hasPendingPayments ? 'text-red-500' : 'text-emerald-500'
          }`}
        >
          {paymentStatus}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Click para ver detalle</p>
      </TooltipContent>
    </Tooltip>
  );
}
