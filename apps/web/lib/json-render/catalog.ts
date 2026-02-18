/**
 * TripGenie json-render Catalog
 * Defines travel UI components for generative UI
 */

import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react';
import { z } from 'zod/v4';

export const catalog = (defineCatalog as any)(schema, {
  components: {
    // Itinerary Components
    ItineraryDay: {
      props: z.object({
        dayNumber: z.number(),
        date: z.string(),
        title: z.string(),
      }),
      description: 'A day in the itinerary with a day number, date, and title',
    },

    // Hotel/Accommodation
    HotelCard: {
      props: z.object({
        name: z.string(),
        rating: z.number().min(0).max(5),
        price: z.number(),
        image: z.string().optional(),
        bookingUrl: z.string().optional(),
      }),
      description: 'Display a hotel with name, rating, price, and booking link',
    },

    // Activities
    ActivityCard: {
      props: z.object({
        name: z.string(),
        description: z.string(),
        duration: z.number().optional(),
        price: z.number().optional(),
        rating: z.number().min(0).max(5).optional(),
        image: z.string().optional(),
        bookingUrl: z.string().optional(),
      }),
      description: 'Display an activity or experience with details and booking',
    },

    // Dining
    RestaurantCard: {
      props: z.object({
        name: z.string(),
        cuisine: z.string(),
        priceLevel: z.enum(['$', '$$', '$$$', '$$$$']),
        rating: z.number().min(0).max(5).optional(),
        image: z.string().optional(),
        reservationUrl: z.string().optional(),
      }),
      description: 'Display a restaurant with cuisine, price level, and reservation link',
    },

    // Interactive Elements
    BookingButton: {
      props: z.object({
        label: z.string(),
        url: z.string(),
        provider: z.string().optional(),
      }),
      description: 'A button to book or reserve via an external provider',
    },

    // Display Components
    PriceTag: {
      props: z.object({
        amount: z.number(),
        currency: z.string().default('USD'),
        period: z.enum(['night', 'person', 'total', 'hour']).optional(),
      }),
      description: 'Display a price with currency and optional period (per night, per person, etc.)',
    },

    RatingDisplay: {
      props: z.object({
        rating: z.number().min(0).max(5),
        reviewCount: z.number().optional(),
      }),
      description: 'Display a star rating with optional review count',
    },

    MapMarker: {
      props: z.object({
        lat: z.number(),
        lng: z.number(),
        label: z.string(),
      }),
      description: 'A map marker for a location with coordinates and label',
    },

    // Layout Components
    Section: {
      props: z.object({
        title: z.string(),
      }),
      description: 'A section container with a title',
    },

    Text: {
      props: z.object({
        content: z.string(),
      }),
      description: 'Display text content',
    },

    Image: {
      props: z.object({
        url: z.string(),
        alt: z.string(),
      }),
      description: 'Display an image with alt text',
    },
  },
  actions: {
    trackClick: {
      description: 'Track affiliate click for booking/reservation links',
    },
    saveToTrip: {
      description: 'Save an item (hotel/activity/restaurant) to the trip',
    },
    shareItinerary: {
      description: 'Share the itinerary via link or social media',
    },
  },
});

export type TripGenieCatalog = typeof catalog;
