'use client';

import React from 'react';
import { MapPin, Clock, DollarSign, ExternalLink, Utensils } from 'lucide-react';

export interface Activity {
  id: string;
  name: string;
  description: string;
  duration: number;
  estimatedCost: {
    amount: number;
    currency: string;
  };
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  category: 'sightseeing' | 'adventure' | 'cultural' | 'relaxation' | 'entertainment' | 'shopping';
  location: {
    name: string;
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  vibeMatch?: {
    matchedVibes: string[];
    reasoning: string;
  };
  bookingInfo?: {
    requiresReservation: boolean;
    bookingUrl?: string;
  };
}

export interface Restaurant {
  id: string;
  name: string;
  cuisineType: string[];
  priceLevel: 1 | 2 | 3 | 4;
  description: string;
  estimatedCost: {
    amount: number;
    currency: string;
    perPerson: boolean;
  };
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  location: {
    name: string;
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  dietaryOptions: string[];
  vibeMatch?: {
    matchedVibes: string[];
    reasoning: string;
  };
  reservationInfo?: {
    recommended: boolean;
    url?: string;
  };
}

const categoryEmojis: Record<string, string> = {
  sightseeing: '👀',
  adventure: '🏔️',
  cultural: '🏛️',
  relaxation: '🧘',
  entertainment: '🎭',
  shopping: '🛍️',
};

const mealTypeEmojis: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '☕',
};

interface ActivityCardProps {
  activity: Activity;
  index: number;
}

export function ActivityCard({ activity, index }: ActivityCardProps) {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-sm">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{categoryEmojis[activity.category] || '📍'}</span>
                <h4 className="font-semibold text-gray-900 truncate">{activity.name}</h4>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{activity.description}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(activity.duration)}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              {formatCost(activity.estimatedCost.amount, activity.estimatedCost.currency)}
            </span>
            {activity.location.address && (
              <span className="flex items-center gap-1 truncate max-w-[150px]">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{activity.location.name}</span>
              </span>
            )}
          </div>

          {activity.vibeMatch && activity.vibeMatch.matchedVibes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activity.vibeMatch.matchedVibes.slice(0, 3).map((vibe) => (
                <span
                  key={vibe}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700"
                >
                  {vibe}
                </span>
              ))}
            </div>
          )}

          {activity.bookingInfo?.requiresReservation && (
            <div className="mt-2">
              {activity.bookingInfo.bookingUrl ? (
                <a
                  href={activity.bookingInfo.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium"
                >
                  Book now <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-xs text-amber-600 font-medium">⚠️ Reservation recommended</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RestaurantCardProps {
  restaurant: Restaurant;
}

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPriceLabel = (level: number) => '$'.repeat(level);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
          <Utensils className="w-4 h-4 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{mealTypeEmojis[restaurant.mealType] || '🍽️'}</span>
                <h4 className="font-semibold text-gray-900 truncate">{restaurant.name}</h4>
                <span className="text-xs text-gray-400 font-medium">{getPriceLabel(restaurant.priceLevel)}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{restaurant.description}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              {formatCost(restaurant.estimatedCost.amount, restaurant.estimatedCost.currency)}
              {restaurant.estimatedCost.perPerson && '/person'}
            </span>
            {restaurant.location.address && (
              <span className="flex items-center gap-1 truncate max-w-[150px]">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{restaurant.location.name}</span>
              </span>
            )}
          </div>

          {restaurant.cuisineType.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {restaurant.cuisineType.slice(0, 3).map((cuisine) => (
                <span
                  key={cuisine}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                >
                  {cuisine}
                </span>
              ))}
            </div>
          )}

          {restaurant.reservationInfo?.recommended && (
            <div className="mt-2">
              {restaurant.reservationInfo.url ? (
                <a
                  href={restaurant.reservationInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium"
                >
                  Make reservation <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-xs text-amber-600 font-medium">⚠️ Reservation recommended</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
