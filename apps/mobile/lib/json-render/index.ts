/**
 * json-render Integration for Faroway
 * 
 * This module provides generative UI capabilities using json-render.
 * The AI backend streams UI components that render natively in React Native.
 */

export { catalog } from './catalog';
export { registry } from './registry';
export { useStreamingItinerary } from '../../hooks/useStreamingItinerary';
export { useItineraryGeneration } from '../../hooks/useItineraryGeneration';

export type { CatalogComponents } from './catalog';
export type { StreamingState, UseStreamingItineraryOptions } from '../../hooks/useStreamingItinerary';
export type { ItineraryGenerationState, UseItineraryGenerationInput } from '../../hooks/useItineraryGeneration';
