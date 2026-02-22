'use client';

import React from 'react';
import type { JsonRenderBlock } from '@/hooks/useItineraryStream';

// Import registry components directly since defineRegistry uses Zod v4 + special wiring.
// We render blocks manually using the registry map.
import { registry } from '@/lib/json-render/registry';

/**
 * Error boundary that prevents a single broken block from crashing the whole page.
 */
class BlockErrorBoundary extends React.Component<
  { children: React.ReactNode; blockType: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; blockType: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`[StreamingItineraryView] Block "${this.props.blockType}" failed to render:`, error.message);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface StreamingItineraryViewProps {
  blocks: JsonRenderBlock[];
  isStreaming: boolean;
}

/**
 * Renders accumulated json-render blocks through the web registry.
 * Each block fades in progressively as it arrives from the stream.
 */
export function StreamingItineraryView({ blocks, isStreaming }: StreamingItineraryViewProps) {
  if (blocks.length === 0 && !isStreaming) {
    return null;
  }

  const validBlocks = blocks.filter((b): b is JsonRenderBlock => !!b && typeof b.type === 'string');

  return (
    <div className="space-y-4">
      {validBlocks.map((block, index) => (
        <div
          key={`${block.type}-${index}`}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'both' }}
        >
          <BlockErrorBoundary blockType={block.type}>
            <BlockRenderer block={block} />
          </BlockErrorBoundary>
        </div>
      ))}

      {/* Skeleton placeholders while streaming */}
      {isStreaming && blocks.length > 0 && (
        <div className="space-y-4 animate-pulse">
          <div className="bg-gray-100 rounded-2xl h-32" />
          <div className="bg-gray-100 rounded-2xl h-24" />
        </div>
      )}
    </div>
  );
}

/**
 * Renders a single json-render block using the web registry.
 */
function BlockRenderer({ block }: { block: JsonRenderBlock }) {
  const type = block.type;
  const props = block.props || {};

  // Map from build-spec types to registry component names
  const componentMap: Record<string, string> = {
    TripSummary: 'TripSummary',
    HeroImage: 'Image',
    Section: 'Section',
    Text: 'Text',
    HotelCard: 'HotelCard',
    ItineraryDay: 'ItineraryDay',
    ActivityCard: 'ActivityCard',
    RestaurantCard: 'RestaurantCard',
    DayTimeline: 'DayTimeline',
    BookingButton: 'BookingButton',
    PriceTag: 'PriceTag',
    RatingDisplay: 'RatingDisplay',
    RatingStars: 'RatingDisplay',
    MapMarker: 'MapMarker',
    MapPreview: 'MapMarker',
    Image: 'Image',
  };

  const componentName = componentMap[type] || type;

  // Get the registry component renderer
  const registryComponents = (registry as any)?.components || registry;
  const Component = registryComponents?.[componentName];

  // If the component exists in the registry, render it
  if (Component) {
    try {
      return <Component props={props} />;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for components not in the registry
  return <FallbackBlock type={type} props={props} />;
}

/**
 * Fallback renderer for TripSummary (which the web registry doesn't have yet via defineRegistry)
 * and DayTimeline.
 */
function FallbackBlock({ type, props }: { type: string; props: Record<string, unknown> }) {
  switch (type) {
    case 'TripSummary':
      return <TripSummaryBlock {...props} />;
    case 'DayTimeline':
      return <DayTimelineBlock items={(props.items as TimelineItem[]) || []} />;
    default:
      return null;
  }
}

// ── TripSummary (web-styled) ───────────────────────────────────────────────

function TripSummaryBlock(props: Record<string, unknown>) {
  const { destination, dates, travelers, budget } = props as {
    destination?: string;
    dates?: string;
    travelers?: number;
    budget?: string;
  };

  return (
    <div className="bg-gradient-to-br from-primary to-primary-700 rounded-2xl p-6 text-white">
      <h2 className="text-2xl font-bold mb-3">{destination}</h2>
      <div className="flex flex-wrap gap-4 text-sm opacity-90">
        {dates && (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{dates}</span>
          </div>
        )}
        {travelers && (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{travelers} traveler{(travelers as number) > 1 ? 's' : ''}</span>
          </div>
        )}
        {budget && (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="capitalize">{budget}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DayTimeline (web-styled) ───────────────────────────────────────────────

interface TimelineItem {
  time: string;
  title: string;
  type: string;
}

function DayTimelineBlock({ items }: { items: TimelineItem[] }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'restaurant': return { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: '🍽️' };
      case 'transport': return { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: '🚗' };
      case 'rest': return { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', icon: '😴' };
      default: return { dot: 'bg-primary', bg: 'bg-primary-50', text: 'text-primary-700', icon: '📍' };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="space-y-0">
        {items.map((item, index) => {
          const colors = getTypeColor(item.type);
          return (
            <div key={index} className="flex items-start gap-3">
              {/* Time */}
              <div className="w-12 flex-shrink-0 pt-2">
                <span className="text-xs font-semibold text-gray-500">{item.time}</span>
              </div>

              {/* Timeline dot + line */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${colors.dot} mt-2`} />
                {index < items.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 min-h-[24px]" />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 ${colors.bg} rounded-lg px-3 py-2 mb-2`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{colors.icon}</span>
                  <span className={`text-sm font-medium ${colors.text}`}>{item.title}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
