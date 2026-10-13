// Destino de una venta/cotizacion. Las ventas nuevas ya no guardan un destino
// general: el destino va en cada servicio (hospedaje -> destino del hotel, tour
// -> su destino, vuelo -> ciudad de llegada). Esto arma el texto a mostrar.

type Dest = { name: string; season?: { name: string; color?: string | null } | null } | null | undefined;

interface ItemLike {
  type?: string;
  destination?: Dest;
  hotel?: { destination?: Dest } | null;
  flightDestination?: string | null;
  direction?: string | null;
}

export function bookingDestination(booking: { destination?: Dest; items?: ItemLike[] | null }): {
  name: string | null;
  season: { name: string; color?: string | null } | null;
} {
  if (booking.destination?.name) return { name: booking.destination.name, season: booking.destination.season ?? null };

  const items = booking.items ?? [];
  const dests = items.map((i) => i.destination ?? i.hotel?.destination).filter((d): d is NonNullable<Dest> => !!d?.name);
  if (dests.length) {
    const names = [...new Set(dests.map((d) => d.name))];
    return { name: names.join(', '), season: dests.find((d) => d.season)?.season ?? null };
  }

  // Solo vuelos: la ciudad de llegada (de la ida, si hay ida y regreso)
  const flights = items.filter((i) => i.type === 'FLIGHT' && i.flightDestination);
  const outbound = flights.filter((i) => i.direction !== 'REGRESO');
  const cities = [...new Set((outbound.length ? outbound : flights).map((i) => i.flightDestination as string))];
  return { name: cities.length ? cities.join(', ') : null, season: null };
}
