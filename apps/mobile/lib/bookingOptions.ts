import type { Activity, Trip } from '../stores/tripStore';
import { formatKnownPrice } from './tripCost';

/** These are candidates for saved-plan review, not confirmed available inventory. */
export function collectBookingOptions(trip: Trip): { activity: Activity; dayNumber: number }[] {
  const items: { activity: Activity; dayNumber: number }[] = [];
  for (const day of trip.days) {
    if (day.transport?.bookingUrl) {
      const transport = day.transport;
      items.push({
        dayNumber: day.dayNumber,
        activity: {
          id: `transport-${day.dayNumber}-${day.date}`,
          time: '',
          title: transport.provider || 'Transport option',
          description: '',
          location: transport.departure.city,
          duration: '',
          type: 'transport',
          price: formatKnownPrice(transport.price, transport.currency),
          bookingUrl: transport.bookingUrl,
          affiliatePartner: transport.affiliatePartner,
        },
      });
    }
    for (const activity of day.activities) {
      if (activity.bookingUrl) items.push({ activity, dayNumber: day.dayNumber });
    }
  }
  if (trip.hotel?.bookingUrl) {
    const hotel = trip.hotel;
    items.unshift({
      dayNumber: 0,
      activity: {
        id: hotel.id,
        time: '',
        title: hotel.name,
        description: hotel.description,
        location: hotel.location?.name || '',
        duration: '',
        type: 'accommodation',
        price: `${formatKnownPrice(hotel.pricePerNight, hotel.currency)} / night`,
        bookingUrl: hotel.bookingUrl,
      },
    });
  }
  return items;
}
