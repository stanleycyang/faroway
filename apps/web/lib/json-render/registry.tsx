/**
 * TripGenie json-render Registry (Web)
 * Maps catalog components to React components styled for the web design system.
 * Includes TripSummary and DayTimeline for parity with mobile.
 * Affiliate links route through /api/track/click for tracking.
 */

import { defineRegistry } from '@json-render/react';
import { catalog } from './catalog';

// Props types for registry components
type TripSummaryProps = { destination: string; dates: string; travelers: number; budget?: string };
type DayTimelineProps = { items: Array<{ time: string; title: string; type: string }> };
type ItineraryDayProps = { dayNumber: number; date: string; title: string };
type HotelCardProps = { name: string; rating: number; price: number; pricePerNight?: number; image?: string; bookingUrl?: string; amenities?: string[]; description?: string; reviewCount?: number; starRating?: number; featured?: boolean };
type ActivityCardProps = { name: string; description: string; duration?: number | string; price?: number; rating?: number; reviewCount?: number; image?: string; bookingUrl?: string; time?: string; location?: string; category?: string };
type RestaurantCardProps = { name: string; cuisine: string; priceLevel: string | number; rating?: number; reviewCount?: number; image?: string; reservationUrl?: string; description?: string; time?: string };
type BookingButtonProps = { label: string; url: string; provider?: string; price?: number };
type PriceTagProps = { amount: number; currency: string; period?: string };
type RatingDisplayProps = { rating: number; reviewCount?: number };
type MapMarkerProps = { lat: number; lng: number; label: string };
type SectionProps = { title: string };
type TextProps = { content: string; variant?: string };
type ImageProps = { url: string; alt: string };

/**
 * Track an affiliate click via /api/track/click and open the URL.
 */
function handleAffiliateClick(
  url: string,
  partner?: string,
  productName?: string,
  itemType: 'hotel' | 'activity' | 'restaurant' = 'activity'
) {
  // Fire and forget tracking request
  if (partner && url) {
    fetch('/api/track/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemType,
        itemId: url,
        itemName: productName || 'Unknown',
        affiliatePartner: partner,
        affiliateUrl: url,
        source: 'itinerary',
      }),
    }).catch(() => {
      // Non-blocking — don't prevent navigation
    });
  }

  // Open in new tab with proper rel attributes
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Helper: safely extract props, guarding against the defineRegistry wrapper
// passing undefined or a different shape than expected.
function safeProps<T>(arg: any): T {
  if (!arg) return {} as T;
  if (typeof arg === 'object' && 'props' in arg) return (arg.props ?? {}) as T;
  return arg as T;
}

// Category color mappings for ActivityCard
const categoryBorderColors: Record<string, string> = {
  sightseeing: 'border-l-amber-400',
  adventure: 'border-l-green-400',
  cultural: 'border-l-purple-400',
  relaxation: 'border-l-blue-400',
  entertainment: 'border-l-pink-400',
  shopping: 'border-l-rose-400',
  food: 'border-l-orange-400',
  nature: 'border-l-emerald-400',
};

export const { registry } = (defineRegistry as any)(catalog, {
  components: {
    ItineraryDay: (arg: { props: ItineraryDayProps; children?: React.ReactNode }) => {
      const props = safeProps<ItineraryDayProps>(arg);
      const children = arg?.children;
      if (!props.dayNumber && !props.title) return null;
      return (
        <div className="border-l-4 border-primary pl-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-white">
              Day {props.dayNumber}
            </span>
            {props.date && (
              <span className="text-sm text-gray-500">
                {new Date(props.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mt-1">{props.title}</h3>
          <div className="mt-3 space-y-3">{children}</div>
        </div>
      );
    },

    HotelCard: (arg: { props: HotelCardProps }) => {
      const props = safeProps<HotelCardProps>(arg);
      if (!props.name) return null;
      return (
        <div className={`bg-white rounded-2xl border ${props.featured ? 'border-primary-200 ring-1 ring-primary-100' : 'border-gray-200'} shadow-sm overflow-hidden hover:shadow-md transition-shadow`}>
          {props.image && (
            <div className="relative">
              <img
                src={props.image}
                alt={props.name}
                className="w-full h-48 object-cover"
              />
              {props.featured && (
                <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-primary-700">
                  Recommended Stay
                </div>
              )}
            </div>
          )}
          <div className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900 text-lg">{props.name}</h4>
                {props.starRating && (
                  <span className="text-yellow-500 text-sm">{'★'.repeat(Math.min(5, props.starRating))}</span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-yellow-500">★</span>
                <span className="text-sm font-medium text-gray-700">{(props.rating ?? 0).toFixed(1)}</span>
                {props.reviewCount != null && (
                  <span className="text-xs text-gray-500">({props.reviewCount})</span>
                )}
              </div>
            </div>
            {props.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{props.description}</p>
            )}
            {props.amenities && props.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {props.amenities.slice(0, 5).map((amenity, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-600">
                    {amenity}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-gray-900">${props.pricePerNight || props.price || 0}</span>
                <span className="text-sm text-gray-500 ml-1">/ night</span>
              </div>
              {props.bookingUrl && (
                <button
                  onClick={() => handleAffiliateClick(props.bookingUrl!, 'booking', props.name, 'hotel')}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-600 transition-colors"
                >
                  View Hotel
                </button>
              )}
            </div>
          </div>
        </div>
      );
    },

    ActivityCard: (arg: { props: ActivityCardProps }) => {
      const props = safeProps<ActivityCardProps>(arg);
      if (!props.name) return null;
      const borderClass = props.category ? (categoryBorderColors[props.category] || 'border-l-primary-400') : 'border-l-primary-400';

      return (
        <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow border-l-4 ${borderClass}`}>
          {props.time && (
            <div className="px-4 py-2 bg-primary-50 border-b border-primary-100 flex items-center gap-2">
              <span className="text-primary-600 text-sm">🕒</span>
              <span className="text-sm font-semibold text-primary-700">{props.time}</span>
            </div>
          )}
          <div className="flex p-4 gap-4">
            {props.image && (
              <img src={props.image} alt={props.name} className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900">{props.name}</h4>
              {props.location && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <span>📍</span> {props.location}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{props.description}</p>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                {props.duration && <span>⏱ {props.duration}{typeof props.duration === 'number' ? 'h' : ''}</span>}
                {typeof props.rating === 'number' && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    {props.rating.toFixed(1)}
                    {props.reviewCount != null && <span className="text-xs">({props.reviewCount})</span>}
                  </span>
                )}
                {props.price != null && <span className="font-medium text-primary-600 ml-auto">${props.price}</span>}
              </div>
              {props.bookingUrl && (
                <button
                  onClick={() => handleAffiliateClick(props.bookingUrl!, 'viator', props.name, 'activity')}
                  className="mt-3 w-full text-center py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-semibold hover:from-red-600 hover:to-red-700 transition-all shadow-sm"
                >
                  Book on Viator →
                </button>
              )}
            </div>
          </div>
        </div>
      );
    },

    RestaurantCard: (arg: { props: RestaurantCardProps }) => {
      const props = safeProps<RestaurantCardProps>(arg);
      if (!props.name) return null;
      const priceLevelNum = typeof props.priceLevel === 'number'
        ? props.priceLevel
        : (props.priceLevel?.length || 2);

      // Render price level with filled/unfilled dollar signs
      const priceDisplay = (
        <span className="flex items-center gap-0.5">
          {[1, 2, 3, 4].map(i => (
            <span key={i} className={`text-sm font-bold ${i <= priceLevelNum ? 'text-green-600' : 'text-gray-300'}`}>$</span>
          ))}
        </span>
      );

      return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow border-l-4 border-l-orange-400">
          {props.time && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <span className="text-red-500 text-sm">🍽️</span>
              <span className="text-sm font-semibold text-red-700">{props.time}</span>
            </div>
          )}
          <div className="flex p-4 gap-4">
            {props.image && (
              <img src={props.image} alt={props.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900">{props.name}</h4>
              <div className="flex items-center gap-2 mt-1 text-sm">
                {/* Cuisine pills */}
                {props.cuisine && props.cuisine.split(',').map((c, i) => (
                  <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700">
                    {c.trim()}
                  </span>
                )).slice(0, 2)}
                {priceDisplay}
              </div>
              {props.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{props.description}</p>
              )}
              {typeof props.rating === 'number' && (
                <div className="flex items-center gap-1 mt-2 text-sm">
                  <span className="text-yellow-500">★</span>
                  <span className="font-medium text-gray-700">{props.rating.toFixed(1)}</span>
                  {props.reviewCount != null && (
                    <span className="text-gray-500">({props.reviewCount} reviews)</span>
                  )}
                </div>
              )}
              {props.reservationUrl && (
                <button
                  onClick={() => handleAffiliateClick(props.reservationUrl!, 'opentable', props.name, 'restaurant')}
                  className="mt-3 w-full text-center py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm"
                >
                  Reserve Table →
                </button>
              )}
            </div>
          </div>
        </div>
      );
    },

    BookingButton: (arg: { props: BookingButtonProps }) => {
      const props = safeProps<BookingButtonProps>(arg);
      if (!props.url || !props.label) return null;
      return (
        <button
          onClick={() => handleAffiliateClick(props.url, props.provider, props.label)}
          className="w-full bg-gradient-to-r from-primary to-primary-600 text-white rounded-xl p-4 flex items-center justify-between hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm hover:shadow-md"
        >
          <div>
            <span className="font-semibold text-lg">{props.label}</span>
            {props.provider && (
              <span className="block text-xs text-white/80 mt-0.5">via {props.provider}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {props.price != null && <span className="font-bold text-xl">${props.price}</span>}
            <span className="text-lg">→</span>
          </div>
        </button>
      );
    },

    PriceTag: (arg: { props: PriceTagProps }) => {
      const props = safeProps<PriceTagProps>(arg);
      if (props.amount == null) return null;
      return (
        <div className="inline-flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-900">
            ${(props.amount ?? 0).toLocaleString()}
          </span>
          <span className="text-xs text-gray-500 uppercase">{props.currency || 'USD'}</span>
          {props.period && (
            <span className="text-sm text-gray-500">/ {props.period}</span>
          )}
        </div>
      );
    },

    RatingDisplay: (arg: { props: RatingDisplayProps }) => {
      const props = safeProps<RatingDisplayProps>(arg);
      if (typeof props.rating !== 'number') return null;
      return (
        <div className="inline-flex items-center gap-1.5">
          <span className="text-yellow-500">★</span>
          <span className="font-semibold text-gray-900">{props.rating.toFixed(1)}</span>
          {props.reviewCount != null && (
            <span className="text-sm text-gray-500">({props.reviewCount.toLocaleString()})</span>
          )}
        </div>
      );
    },

    MapMarker: (arg: { props: MapMarkerProps }) => {
      const props = safeProps<MapMarkerProps>(arg);
      if (typeof props.lat !== 'number' || typeof props.lng !== 'number') return null;
      return (
        <div className="inline-flex items-center gap-2 text-sm">
          <span className="text-red-600">📍</span>
          <span className="text-gray-700">{props.label || 'Location'}</span>
          <span className="text-xs text-gray-400">
            ({props.lat.toFixed(4)}, {props.lng.toFixed(4)})
          </span>
        </div>
      );
    },

    Section: (arg: { props: SectionProps; children?: React.ReactNode }) => {
      const props = safeProps<SectionProps>(arg);
      const children = arg?.children;
      return (
        <section className="my-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gray-200" />
            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
              {props.title || 'Section'}
            </h2>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="space-y-4">{children}</div>
        </section>
      );
    },

    Text: (arg: { props: TextProps }) => {
      const props = safeProps<TextProps>(arg);
      return (
        <p className={`leading-relaxed ${
          props.variant === 'caption' ? 'text-sm text-gray-500' :
          props.variant === 'subtitle' ? 'text-sm font-semibold text-gray-600' :
          props.variant === 'title' ? 'text-lg font-bold text-gray-900' :
          'text-gray-700'
        }`}>
          {props.content || ''}
        </p>
      );
    },

    Image: (arg: { props: ImageProps }) => {
      const props = safeProps<ImageProps>(arg);
      if (!props.url) return null;
      return (
        <img
          src={props.url}
          alt={props.alt || ''}
          className="w-full rounded-2xl shadow-sm"
        />
      );
    },
  },
});

export type TripGenieRegistry = typeof registry;
