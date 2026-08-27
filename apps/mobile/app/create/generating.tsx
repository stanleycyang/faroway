import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Easing,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTripStore, Trip, TripDay, TripInput, Activity } from '../../stores/tripStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { AuthGate } from '../../components/AuthGate';
import { popularDestinations, IMAGE_PATHS, getImageUrl } from '@faroway/constants';
import { colors } from '../../constants/theme';
import { useStreamingItinerary, StreamingBlock } from '../../hooks/useStreamingItinerary';
import {
  buildSeededItineraryOutline,
  type SeededItineraryOutline,
} from '../../lib/itineraryPreview';
import { registry } from '../../lib/json-render/registry';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const { width, height } = Dimensions.get('window');

const GENERATION_STEPS = [
  { key: 'orchestrator', text: 'Planning', emoji: '🔍', color: '#8B5CF6' },
  { key: 'hotels', text: 'Hotels', emoji: '🏨', color: '#F59E0B' },
  { key: 'activities', text: 'Activities', emoji: '✨', color: '#10B981' },
  { key: 'dining', text: 'Dining', emoji: '🍽️', color: '#EF4444' },
  { key: 'transport', text: 'Transport', emoji: '✈️', color: '#06B6D4' },
  { key: 'budget', text: 'Budget', emoji: '💳', color: '#14B8A6' },
  { key: 'enrichment', text: 'Local tips', emoji: '💡', color: '#84CC16' },
  { key: 'aggregator', text: 'Itinerary', emoji: '📝', color: '#3B82F6' },
];

const DESTINATION_FACTS: Record<string, string[]> = {
  Paris: [
    "The Eiffel Tower was meant to be temporary, built for the 1889 World's Fair.",
    'Paris has 470+ parks and gardens covering 3,000+ acres.',
    'The Louvre would take 100 days to see every artwork for 30 seconds each.',
    'There are more dogs than children in Paris.',
  ],
  Tokyo: [
    'Tokyo has more Michelin-starred restaurants than any other city.',
    'The Shibuya Crossing sees 3,000 people cross at once during rush hour.',
    'Tokyo was called Edo until 1868 when it became the capital.',
    'Vending machines in Tokyo sell everything from eggs to umbrellas.',
  ],
  Rome: [
    'Rome has more fountains than any other city in the world.',
    "The Pantheon has the world's largest unreinforced concrete dome.",
    'Trevi Fountain collects €1.5 million in coins annually.',
    'Cats have legal protection at Roman archaeological sites.',
  ],
  London: [
    'Big Ben is actually the name of the bell, not the tower.',
    'London has 170 museums, many of which are free.',
    "The Underground is the world's oldest metro system.",
    'There are over 300 languages spoken in London.',
  ],
  'New York': [
    'The NYC subway runs 24/7, 365 days a year.',
    'Central Park is larger than Monaco.',
    'Times Square was originally called Longacre Square.',
    'The Statue of Liberty was a gift from France in 1886.',
  ],
  default: [
    'Your personalized itinerary includes local hidden gems.',
    'Our AI considers weather, crowds, and local events.',
    'We match activities to your unique travel style.',
    'Every recommendation is curated for your preferences.',
  ],
};

interface StreamingLocation {
  name?: string;
  neighborhood?: string;
}

interface StreamingItem {
  id?: string;
  name?: string;
  description?: string;
  location?: StreamingLocation;
  duration?: number;
  price?: number;
  priceLevel?: number | string;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  affiliateUrl?: string;
  reservationUrl?: string;
}

interface StreamingPeriod {
  meal?: StreamingItem;
  activities?: StreamingItem[];
}

interface StreamingDay {
  date?: string;
  dayNumber?: number;
  title?: string;
  morning?: StreamingPeriod;
  afternoon?: StreamingPeriod;
  evening?: StreamingPeriod;
}

interface StreamingHotel {
  id?: string;
  name?: string;
  description?: string;
  pricePerNight?: number;
  totalPrice?: number;
  userRating?: number;
  rating?: number;
  starRating?: number;
  reviewCount?: number;
  amenities?: string[];
  images?: string[];
  affiliateUrl?: string;
  location?: unknown;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isHotelLocation(value: unknown): value is NonNullable<Trip['hotel']>['location'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'address' in value &&
    'lat' in value &&
    'lng' in value &&
    typeof value.name === 'string' &&
    typeof value.address === 'string' &&
    typeof value.lat === 'number' &&
    typeof value.lng === 'number'
  );
}

function convertStreamingDataToTrip(
  tripId: string,
  itineraryDays: unknown[],
  topHotel: Record<string, unknown> | null,
  input: TripInput
): Trip {
  const destinationInfo = popularDestinations.find((d) => d.name === input.destination);

  const days: TripDay[] = itineraryDays.map((dayValue, dayIndex) => {
    const day = dayValue as StreamingDay;
    const dayNumber = day.dayNumber || dayIndex + 1;
    const activities: Activity[] = [];

    const processActivities = (items: StreamingItem[] | undefined, startHour: number) => {
      items?.forEach((activity, idx) => {
        activities.push({
          id: activity.id || `activity-${dayNumber}-${startHour + idx}`,
          time: `${startHour + idx}:00`,
          title: activity.name || 'Recommended stop',
          description: activity.description || '',
          location: activity.location?.name || activity.location?.neighborhood || '',
          duration: activity.duration ? `${Math.round(activity.duration / 60)} hours` : '2 hours',
          type: 'activity',
          price: activity.price ? `$${activity.price}` : undefined,
          rating: activity.rating,
          reviewCount: activity.reviewCount,
          image: activity.images?.[0],
          bookingUrl: activity.affiliateUrl,
        });
      });
    };

    const processMeal = (meal: StreamingItem | undefined, time: string) => {
      if (!meal) return;
      activities.push({
        id: meal.id || `meal-${dayNumber}-${time}`,
        time,
        title: meal.name || 'Recommended meal',
        description: meal.description || '',
        location: meal.location?.name || meal.location?.neighborhood || '',
        duration: '1 hour',
        type: 'restaurant',
        price: meal.priceLevel
          ? '$'.repeat(typeof meal.priceLevel === 'number' ? meal.priceLevel : 2)
          : undefined,
        rating: meal.rating,
        reviewCount: meal.reviewCount,
        image: meal.images?.[0],
        bookingUrl: meal.reservationUrl,
      });
    };

    processMeal(day.morning?.meal, '08:00');
    processActivities(day.morning?.activities, 9);
    processMeal(day.afternoon?.meal, '12:30');
    processActivities(day.afternoon?.activities, 14);
    processActivities(day.evening?.activities, 18);
    processMeal(day.evening?.meal, '19:30');

    activities.sort((a, b) => {
      const timeA = parseInt(a.time.split(':')[0]);
      const timeB = parseInt(b.time.split(':')[0]);
      return timeA - timeB;
    });

    return {
      date: day.date || input.startDate,
      dayNumber,
      theme: day.title || `Day ${dayNumber}`,
      activities,
    };
  });

  const hotel = topHotel as StreamingHotel | null;
  const hotelImages = isStringArray(hotel?.images) ? hotel.images : [];
  const hotelAmenities = isStringArray(hotel?.amenities) ? hotel.amenities : [];
  const hotelLocation = isHotelLocation(hotel?.location)
    ? hotel.location
    : {
        name: input.destination,
        address: '',
        lat: 0,
        lng: 0,
      };

  return {
    id: tripId,
    destination: input.destination,
    country: input.country || destinationInfo?.country || '',
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers || 2,
    travelerType: input.travelerType,
    vibes: input.vibes || [],
    budget: input.budget,
    days,
    hotel: hotel?.name
      ? {
          id: hotel.id || 'hotel-1',
          name: hotel.name,
          description: hotel.description || '',
          pricePerNight: hotel.pricePerNight || 0,
          totalPrice: hotel.totalPrice || 0,
          rating: hotel.userRating || hotel.rating || 0,
          reviewCount: hotel.reviewCount || 0,
          amenities: hotelAmenities,
          images: hotelImages,
          bookingUrl: hotel.affiliateUrl || '',
          location: hotelLocation,
        }
      : undefined,
    coverImage:
      destinationInfo?.image ||
      hotelImages[0] ||
      getImageUrl(IMAGE_PATHS.inspirations['beach-getaway']),
    createdAt: new Date().toISOString(),
    status: 'planned',
  };
}
