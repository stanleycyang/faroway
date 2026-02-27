'use client';

import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import type { GeneratedItinerary } from '@/lib/ai/types';

interface MapMarker {
  lat: number;
  lng: number;
  name: string;
  type: 'activity' | 'meal';
  dayNumber: number;
  timeOfDay: string;
}

interface ItineraryMapProps {
  itinerary: GeneratedItinerary;
  className?: string;
}

const TIME_COLORS: Record<string, string> = {
  morning: '#F59E0B',   // amber
  afternoon: '#F25D3B', // primary/red-orange
  evening: '#8B5CF6',   // purple
};

function extractMarkers(itinerary: GeneratedItinerary): MapMarker[] {
  const markers: MapMarker[] = [];

  for (const day of itinerary.days) {
    for (const timeOfDay of ['morning', 'afternoon', 'evening'] as const) {
      const slot = day[timeOfDay];
      if (!slot) continue;
      interface SlotItem { name?: string; location?: { coordinates?: { lat: number; lng: number } } }
      const rawActivities = Array.isArray(slot.activities) ? slot.activities : [];
      const activities = rawActivities.filter((a) => a != null && typeof a === 'object') as SlotItem[];
      const slotRecord = slot as unknown as Record<string, unknown>;
      const rawMeals: unknown[] = Array.isArray(slotRecord.meals)
        ? slotRecord.meals
        : slotRecord.meal && typeof slotRecord.meal === 'object'
          ? [slotRecord.meal]
          : [];
      const meals = rawMeals.filter((m) => m != null && typeof m === 'object') as SlotItem[];
      for (const activity of activities) {
        const coords = activity.location?.coordinates;
        if (coords?.lat && coords?.lng && activity.name) {
          markers.push({
            lat: coords.lat,
            lng: coords.lng,
            name: activity.name,
            type: 'activity',
            dayNumber: day.dayNumber,
            timeOfDay,
          });
        }
      }
      for (const meal of meals) {
        const coords = meal.location?.coordinates;
        if (coords?.lat && coords?.lng && meal.name) {
          markers.push({
            lat: coords.lat,
            lng: coords.lng,
            name: meal.name,
            type: 'meal',
            dayNumber: day.dayNumber,
            timeOfDay,
          });
        }
      }
    }
  }

  return markers;
}

export function ItineraryMap({ itinerary, className }: ItineraryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const markers = useMemo(() => extractMarkers(itinerary), [itinerary]);

  useEffect(() => {
    if (!mapRef.current || markers.length === 0) return;

    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    for (const marker of markers) {
      const color = TIME_COLORS[marker.timeOfDay] || '#F25D3B';
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;
          background:${color};
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          color:white;font-size:11px;font-weight:700;
        ">${marker.dayNumber}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const label = `<strong>Day ${marker.dayNumber}</strong> &middot; ${marker.timeOfDay}<br/>${marker.name}`;
      L.marker([marker.lat, marker.lng], { icon })
        .addTo(map)
        .bindPopup(label);

      bounds.extend([marker.lat, marker.lng]);
    }

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });

    mapInstanceRef.current = map;

    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [markers]);

  if (markers.length === 0) return null;

  return (
    <div className={className}>
      <div ref={mapRef} className="h-full w-full" />
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: TIME_COLORS.morning }} />
          Morning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: TIME_COLORS.afternoon }} />
          Afternoon
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: TIME_COLORS.evening }} />
          Evening
        </span>
      </div>
    </div>
  );
}
