/**
 * json-render Integration for TripGenie
 * 
 * This module provides generative UI capabilities using json-render.
 * The AI backend streams UI components that render natively in React Native.
 */

export { catalog } from './catalog';
export { registry } from './registry';
export { useStreamingItinerary } from '../../hooks/useStreamingItinerary';

export type { CatalogComponents } from './catalog';
export type { StreamingState, UseStreamingItineraryOptions } from '../../hooks/useStreamingItinerary';
