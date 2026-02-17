'use client';

import { useState, useEffect, useMemo } from 'react';
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
import {
  Plane,
  MapPin,
  Hotel,
  Calendar,
  User,
  Truck,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Trip {
  id: string;
  clientName: string;
  destinationName: string;
  hotelName: string | null;
  supplierName: string | null;
  departureDate: string;
  returnDate: string;
  totalPrice: number;
  paymentType: string;
  paymentStatus: 'CERRADO' | 'SALDO';
  tripStatus: 'IN_TRANSIT' | 'UPCOMING' | 'RETURNED';
  agentName: string | null;
}

export function TripStatusPanel() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'returned'>('active');

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales/trips');
      if (res.ok) {
        setTrips(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount for badge count
  useEffect(() => {
    fetchTrips();
  }, []);

  // Re-fetch when panel opens
  useEffect(() => {
    if (open) fetchTrips();
  }, [open]);

  const { inTransit, upcoming, returned } = useMemo(() => {
    return {
      inTransit: trips.filter((t) => t.tripStatus === 'IN_TRANSIT'),
      upcoming: trips.filter((t) => t.tripStatus === 'UPCOMING'),
      returned: trips.filter((t) => t.tripStatus === 'RETURNED'),
    };
  }, [trips]);

  const activeCount = inTransit.length + upcoming.length;

  const handleTripClick = (tripId: string) => {
    setOpen(false);
    router.push(`/sales/${tripId}`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Plane className="h-5 w-5" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[440px] sm:w-[500px] p-0">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-blue-500" />
            Expedientes de Viaje
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Viajes en tránsito, próximos y recién regresados
          </p>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              activeTab === 'active'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            En Tránsito / Próximos
            {activeCount > 0 && (
              <Badge className="ml-1.5 bg-blue-500 text-white text-[10px] px-1.5 py-0">
                {activeCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab('returned')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              activeTab === 'returned'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Regresaron
            {returned.length > 0 && (
              <Badge className="ml-1.5 bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                {returned.length}
              </Badge>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : activeTab === 'active' ? (
            <>
              {/* In Transit Section */}
              {inTransit.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      En Tránsito ({inTransit.length})
                    </span>
                  </div>
                  {inTransit.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      color="blue"
                      onClick={() => handleTripClick(trip.id)}
                    />
                  ))}
                </div>
              )}

              {/* Upcoming Section */}
              {upcoming.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                      Próximos a Salir ({upcoming.length})
                    </span>
                  </div>
                  {upcoming.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      color="amber"
                      onClick={() => handleTripClick(trip.id)}
                    />
                  ))}
                </div>
              )}

              {activeCount === 0 && (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  <Plane className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No hay viajes en tránsito o próximos
                </div>
              )}
            </>
          ) : (
            <>
              {returned.length > 0 ? (
                <div>
                  <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                      Regresaron ({returned.length})
                    </span>
                  </div>
                  {returned.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      color="emerald"
                      onClick={() => handleTripClick(trip.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  <Plane className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No hay viajes recién regresados
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Trip Card ───────────────────────────────────────

function TripCard({
  trip,
  color,
  onClick,
}: {
  trip: Trip;
  color: 'blue' | 'amber' | 'emerald';
  onClick: () => void;
}) {
  const colorMap = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  };

  const departure = new Date(trip.departureDate);
  const returnDate = new Date(trip.returnDate);
  const now = new Date();

  // Days until departure or since return
  let daysLabel = '';
  if (trip.tripStatus === 'UPCOMING') {
    const days = Math.ceil((departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    daysLabel = days === 1 ? 'Sale mañana' : days === 0 ? 'Sale hoy' : `Sale en ${days} días`;
  } else if (trip.tripStatus === 'IN_TRANSIT') {
    const days = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    daysLabel = days === 0 ? 'Regresa hoy' : `Regresa en ${days} días`;
  } else {
    const days = Math.ceil((now.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));
    daysLabel = days === 0 ? 'Regresó hoy' : days === 1 ? 'Regresó ayer' : `Regresó hace ${days} días`;
  }

  return (
    <div
      onClick={onClick}
      className="flex gap-3 p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors"
    >
      {/* Color bar */}
      <div className={`w-1.5 rounded-full shrink-0 ${colorMap[color]}`} />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Client name + payment status */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate">{trip.clientName}</span>
          <Badge
            className={`shrink-0 text-[10px] px-1.5 ${
              trip.paymentStatus === 'CERRADO'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }`}
          >
            {trip.paymentStatus === 'CERRADO' ? 'Cerrado' : 'Saldo'}
          </Badge>
        </div>

        {/* Days label */}
        <div className={`text-xs font-medium ${
          color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
          color === 'amber' ? 'text-amber-600 dark:text-amber-400' :
          'text-emerald-600 dark:text-emerald-400'
        }`}>
          {daysLabel}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>Salida: {format(departure, 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>Regreso: {format(returnDate, 'dd/MM/yyyy')}</span>
          </div>
          {trip.destinationName && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{trip.destinationName}</span>
            </div>
          )}
          {trip.hotelName && (
            <div className="flex items-center gap-1">
              <Hotel className="w-3 h-3 shrink-0" />
              <span className="truncate">{trip.hotelName}</span>
            </div>
          )}
          {trip.supplierName && (
            <div className="flex items-center gap-1">
              <Truck className="w-3 h-3 shrink-0" />
              <span className="truncate">{trip.supplierName}</span>
            </div>
          )}
          {trip.agentName && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{trip.agentName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
