/**
 * TripGenie json-render Registry
 * Maps catalog components to actual React components
 */

import { defineRegistry } from '@json-render/react';
import { catalog } from './catalog';

// Props types for registry components (catalog uses `any` cast due to Zod version mismatch)
type ItineraryDayProps = { dayNumber: number; date: string; title: string };
type HotelCardProps = { name: string; rating: number; price: number; image?: string; bookingUrl?: string };
type ActivityCardProps = { name: string; description: string; duration?: number; price?: number; rating?: number; image?: string; bookingUrl?: string };
type RestaurantCardProps = { name: string; cuisine: string; priceLevel: string; rating?: number; image?: string; reservationUrl?: string };
type BookingButtonProps = { label: string; url: string; provider?: string };
type PriceTagProps = { amount: number; currency: string; period?: string };
type RatingDisplayProps = { rating: number; reviewCount?: number };
type MapMarkerProps = { lat: number; lng: number; label: string };
type SectionProps = { title: string };
type TextProps = { content: string };
type ImageProps = { url: string; alt: string };

export const { registry } = (defineRegistry as any)(catalog, {
  components: {
    ItineraryDay: ({ props, children }: { props: ItineraryDayProps; children?: React.ReactNode }) => (
      <div className="border-l-4 border-blue-500 pl-4 py-3 mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-blue-600">Day {props.dayNumber}</span>
          <span className="text-xs text-gray-500">{props.date}</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mt-1">{props.title}</h3>
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    ),

    HotelCard: ({ props }: { props: HotelCardProps }) => (
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        {props.image && (
          <img
            src={props.image}
            alt={props.name}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="p-4">
          <h4 className="font-semibold text-gray-900">{props.name}</h4>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">★</span>
              <span className="text-sm text-gray-600">{props.rating.toFixed(1)}</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">${props.price}</div>
              <div className="text-xs text-gray-500">per night</div>
            </div>
          </div>
          {props.bookingUrl && (
            <a
              href={props.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full text-center bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              View Hotel
            </a>
          )}
        </div>
      </div>
    ),

    ActivityCard: ({ props }: { props: ActivityCardProps }) => (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        {props.image && (
          <img
            src={props.image}
            alt={props.name}
            className="w-full h-32 object-cover"
          />
        )}
        <div className="p-4">
          <h4 className="font-semibold text-gray-900">{props.name}</h4>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{props.description}</p>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            {props.duration && <span>⏱ {props.duration}h</span>}
            {props.rating && (
              <span className="flex items-center gap-1">
                <span className="text-yellow-500">★</span>
                {props.rating.toFixed(1)}
              </span>
            )}
            {props.price && <span className="font-medium">${props.price}</span>}
          </div>
          {props.bookingUrl && (
            <a
              href={props.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full text-center bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Book Activity
            </a>
          )}
        </div>
      </div>
    ),

    RestaurantCard: ({ props }: { props: RestaurantCardProps }) => (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{props.name}</h4>
            <p className="text-sm text-gray-600 mt-1">{props.cuisine}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-700">{props.priceLevel}</span>
              {props.rating && (
                <span className="flex items-center gap-1 text-sm">
                  <span className="text-yellow-500">★</span>
                  {props.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          {props.image && (
            <img
              src={props.image}
              alt={props.name}
              className="w-20 h-20 object-cover rounded-md ml-3"
            />
          )}
        </div>
        {props.reservationUrl && (
          <a
            href={props.reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block w-full text-center bg-orange-600 text-white py-2 rounded-md hover:bg-orange-700 transition-colors text-sm font-medium"
          >
            Make Reservation
          </a>
        )}
      </div>
    ),

    BookingButton: ({ props }: { props: BookingButtonProps }) => (
      <a
        href={props.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        {props.label}
        {props.provider && (
          <span className="text-xs ml-2 opacity-75">via {props.provider}</span>
        )}
      </a>
    ),

    PriceTag: ({ props }: { props: PriceTagProps }) => (
      <div className="inline-flex items-baseline gap-1">
        <span className="text-lg font-bold text-gray-900">
          ${props.amount.toFixed(2)}
        </span>
        <span className="text-xs text-gray-500 uppercase">{props.currency}</span>
        {props.period && (
          <span className="text-xs text-gray-500">/ {props.period}</span>
        )}
      </div>
    ),

    RatingDisplay: ({ props }: { props: RatingDisplayProps }) => (
      <div className="inline-flex items-center gap-1">
        <span className="text-yellow-500">★</span>
        <span className="font-medium text-gray-900">{props.rating.toFixed(1)}</span>
        {props.reviewCount && (
          <span className="text-sm text-gray-500">({props.reviewCount})</span>
        )}
      </div>
    ),

    MapMarker: ({ props }: { props: MapMarkerProps }) => (
      <div className="inline-flex items-center gap-2 text-sm">
        <span className="text-red-600">📍</span>
        <span className="text-gray-700">{props.label}</span>
        <span className="text-xs text-gray-400">
          ({props.lat.toFixed(4)}, {props.lng.toFixed(4)})
        </span>
      </div>
    ),

    Section: ({ props, children }: { props: SectionProps; children?: React.ReactNode }) => (
      <section className="my-6">
        <h2 className="text-xl font-bold text-gray-900 mb-3 border-b pb-2">
          {props.title}
        </h2>
        <div className="space-y-3">{children}</div>
      </section>
    ),

    Text: ({ props }: { props: TextProps }) => (
      <p className="text-gray-700 leading-relaxed">{props.content}</p>
    ),

    Image: ({ props }: { props: ImageProps }) => (
      <img
        src={props.url}
        alt={props.alt}
        className="w-full rounded-lg shadow-md"
      />
    ),
  },
});

export type TripGenieRegistry = typeof registry;
