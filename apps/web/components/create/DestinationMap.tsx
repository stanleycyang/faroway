'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface DestinationMapProps {
  lat: number;
  lng: number;
  name: string;
}

export function DestinationMap({ lat, lng, name }: DestinationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;background:#F25D3B;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    L.marker([lat, lng], { icon }).addTo(map).bindTooltip(name);

    mapInstanceRef.current = map;

    // Leaflet needs a size recalculation after the container is in the DOM
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, name]);

  return <div ref={mapRef} className="h-48 w-full rounded-xl isolate z-0" />;
}
