import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../constants/api';

export interface StreamingState {
  document: any | null; // The json-render document
  isLoading: boolean;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  progress: number; // 0-100
}

export interface UseStreamingItineraryOptions {
  searchId?: string;
  input?: {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    travelerType: string;
    vibes: string[];
    budget?: string;
  };
  onComplete?: (document: any) => void;
  onError?: (error: Error) => void;
  fallbackToPoll?: boolean; // Whether to fall back to polling if streaming fails
}

/**
 * Hook to stream itinerary generation using json-render
 * 
 * This hook connects to the backend streaming endpoint and progressively
 * builds the json-render document as data arrives.
 */
export function useStreamingItinerary(options: UseStreamingItineraryOptions): StreamingState {
  const {
    searchId,
    input,
    onComplete,
    onError,
    fallbackToPoll = true,
  } = options;

  const [state, setState] = useState<StreamingState>({
    document: null,
    isLoading: false,
    isStreaming: false,
    isComplete: false,
    error: null,
    progress: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!input && !searchId) {
      return;
    }

    const startStreaming = async () => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          isStreaming: false,
          error: null,
        }));

        let streamSearchId = searchId;

        // If we have input but no searchId, start a new search first
        if (!searchId && input) {
          const response = await fetch(`${API_BASE_URL}/api/itinerary/stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
          });

          if (!response.ok) {
            throw new Error(`Failed to start streaming: ${response.statusText}`);
          }

          const data = await response.json();
          streamSearchId = data.searchId;
        }

        if (!streamSearchId) {
          throw new Error('No search ID available');
        }

        // Check if SSE is supported
        if (typeof EventSource === 'undefined') {
          console.warn('[useStreamingItinerary] EventSource not supported, falling back to polling');
          if (fallbackToPoll) {
            // TODO: Implement fallback to polling
            throw new Error('Streaming not supported, fallback needed');
          } else {
            throw new Error('EventSource not supported');
          }
        }

        // Connect to the streaming endpoint
        const streamUrl = `${API_BASE_URL}/api/itinerary/stream/${streamSearchId}`;
        const eventSource = new EventSource(streamUrl);
        eventSourceRef.current = eventSource;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isStreaming: true,
        }));

        // Handle incoming chunks
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
              // Progress update
              setState((prev) => ({
                ...prev,
                progress: data.progress || 0,
              }));
            } else if (data.type === 'chunk') {
              // Document chunk - merge with existing document
              setState((prev) => ({
                ...prev,
                document: mergeDocument(prev.document, data.chunk),
              }));
            } else if (data.type === 'complete') {
              // Streaming complete
              const finalDocument = data.document || state.document;
              setState((prev) => ({
                ...prev,
                document: finalDocument,
                isStreaming: false,
                isComplete: true,
                progress: 100,
              }));

              eventSource.close();
              eventSourceRef.current = null;

              if (onComplete) {
                onComplete(finalDocument);
              }
            } else if (data.type === 'error') {
              throw new Error(data.message || 'Streaming error');
            }
          } catch (error) {
            console.error('[useStreamingItinerary] Error processing message:', error);
            setState((prev) => ({
              ...prev,
              error: error instanceof Error ? error.message : 'Unknown error',
              isStreaming: false,
            }));
            eventSource.close();
            eventSourceRef.current = null;

            if (onError) {
              onError(error instanceof Error ? error : new Error('Unknown error'));
            }
          }
        };

        eventSource.onerror = (error) => {
          console.error('[useStreamingItinerary] EventSource error:', error);
          
          const errorMessage = 'Connection error during streaming';
          setState((prev) => ({
            ...prev,
            error: errorMessage,
            isStreaming: false,
            isLoading: false,
          }));

          eventSource.close();
          eventSourceRef.current = null;

          if (onError) {
            onError(new Error(errorMessage));
          }
        };
      } catch (error) {
        console.error('[useStreamingItinerary] Failed to start streaming:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to start streaming';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          isStreaming: false,
        }));

        if (onError) {
          onError(error instanceof Error ? error : new Error('Failed to start streaming'));
        }
      }
    };

    startStreaming();

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, JSON.stringify(input)]);

  return state;
}

/**
 * Merge a document chunk into the existing document
 * This progressively builds the json-render document as chunks arrive
 */
function mergeDocument(existing: any, chunk: any): any {
  if (!existing) {
    return chunk;
  }

  if (Array.isArray(existing) && Array.isArray(chunk)) {
    return [...existing, ...chunk];
  }

  if (typeof existing === 'object' && typeof chunk === 'object') {
    const merged = { ...existing };
    for (const key in chunk) {
      if (Array.isArray(existing[key]) && Array.isArray(chunk[key])) {
        merged[key] = [...existing[key], ...chunk[key]];
      } else if (typeof existing[key] === 'object' && typeof chunk[key] === 'object') {
        merged[key] = mergeDocument(existing[key], chunk[key]);
      } else {
        merged[key] = chunk[key];
      }
    }
    return merged;
  }

  return chunk;
}
