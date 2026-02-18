/**
 * JSON-Render Component Registry for Web
 * Maps catalog component IDs to Tailwind-styled React components
 */

import React from 'react';
import { MapPin, Clock, DollarSign, Star, Users, Calendar, Utensils, Hotel, Plane } from 'lucide-react';

export interface ComponentProps {
  [key: string]: any;
}

// Activity Card Component
export function ActivityCard({ activity }: ComponentProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-1">{activity.name}</h4>
          {activity.description && (
            <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            {activity.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {activity.duration}
              </span>
            )}
            {activity.price && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {activity.price}
              </span>
            )}
            {activity.rating && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {activity.rating}
              </span>
            )}
          </div>
        </div>
      </div>
      {activity.bookingUrl && (
        <a
          href={activity.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full py-2 bg-primary hover:bg-primary-600 text-white text-center rounded-lg font-medium transition-colors"
        >
          Book Now
        </a>
      )}
    </div>
  );
}

// Restaurant Card Component
export function RestaurantCard({ restaurant }: ComponentProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
          <Utensils className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-1">{restaurant.name}</h4>
          {restaurant.cuisine && (
            <p className="text-sm text-gray-600 mb-2">{restaurant.cuisine}</p>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            {restaurant.priceRange && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {restaurant.priceRange}
              </span>
            )}
            {restaurant.rating && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {restaurant.rating}
              </span>
            )}
          </div>
        </div>
      </div>
      {restaurant.reservationUrl && (
        <a
          href={restaurant.reservationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-center rounded-lg font-medium transition-colors"
        >
          Make Reservation
        </a>
      )}
    </div>
  );
}

// Hotel Card Component
export function HotelCard({ hotel }: ComponentProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Hotel className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-1">{hotel.name}</h4>
          {hotel.location && (
            <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {hotel.location}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            {hotel.pricePerNight && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {hotel.pricePerNight}/night
              </span>
            )}
            {hotel.rating && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {hotel.rating}
              </span>
            )}
          </div>
        </div>
      </div>
      {hotel.bookingUrl && (
        <a
          href={hotel.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg font-medium transition-colors"
        >
          View Hotel
        </a>
      )}
    </div>
  );
}

// Day Summary Component
export function DaySummary({ day }: ComponentProps) {
  return (
    <div className="bg-gradient-to-r from-primary-50 to-amber-50 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Day {day.number}</h3>
          <p className="text-sm text-gray-600">{day.date}</p>
        </div>
      </div>
      {day.title && <h4 className="font-semibold text-gray-900 mb-2">{day.title}</h4>}
      {day.summary && <p className="text-sm text-gray-600">{day.summary}</p>}
    </div>
  );
}

// Flight Info Component
export function FlightInfo({ flight }: ComponentProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
          <Plane className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{flight.airline}</h4>
          <p className="text-sm text-gray-600">{flight.flightNumber}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500 mb-1">Departure</p>
          <p className="font-medium text-gray-900">{flight.departure}</p>
          <p className="text-gray-600">{flight.departureTime}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-1">Arrival</p>
          <p className="font-medium text-gray-900">{flight.arrival}</p>
          <p className="text-gray-600">{flight.arrivalTime}</p>
        </div>
      </div>
      {flight.price && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">Price</span>
          <span className="font-semibold text-gray-900">{flight.price}</span>
        </div>
      )}
    </div>
  );
}

// Component Registry Map
export const componentRegistry: Record<string, React.ComponentType<any>> = {
  'activity-card': ActivityCard,
  'restaurant-card': RestaurantCard,
  'hotel-card': HotelCard,
  'day-summary': DaySummary,
  'flight-info': FlightInfo,
};

// Helper function to render from catalog
export function renderComponent(componentId: string, props: ComponentProps) {
  const Component = componentRegistry[componentId];
  
  if (!Component) {
    console.warn(`Component "${componentId}" not found in registry`);
    return null;
  }
  
  return <Component {...props} />;
}
