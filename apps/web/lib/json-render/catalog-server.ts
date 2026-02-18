/**
 * Server-safe catalog prompt for API routes
 * Does NOT import from @json-render/react (which requires React context)
 */

export const catalogPrompt = `You have access to the following UI components for building travel itineraries:

Components:
- ItineraryDay: A day in the itinerary (props: dayNumber: number, date: string, title: string)
- HotelCard: Display a hotel (props: name: string, rating: number 0-5, price: number, image?: string, bookingUrl?: string)
- ActivityCard: Display an activity (props: name: string, description: string, duration?: number, price?: number, rating?: number 0-5, image?: string, bookingUrl?: string)
- RestaurantCard: Display a restaurant (props: name: string, cuisine: string, priceLevel: "$"|"$$"|"$$$"|"$$$$", rating?: number 0-5, image?: string, reservationUrl?: string)
- BookingButton: A booking button (props: label: string, url: string, provider?: string)
- PriceTag: Display a price (props: amount: number, currency: string default "USD", period?: "night"|"person"|"total"|"hour")
- RatingDisplay: Display a star rating (props: rating: number 0-5, reviewCount?: number)
- MapMarker: A map marker (props: lat: number, lng: number, label: string)
- Section: A section with title (props: title: string)
- Text: Display text (props: content: string)
- Image: Display an image (props: url: string, alt: string)

Actions:
- trackClick: Track affiliate click for booking/reservation links
- saveToTrip: Save an item to the trip
- shareItinerary: Share the itinerary`;
