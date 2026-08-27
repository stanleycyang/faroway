import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../constants/api';
import { getAuthHeaders } from '../lib/supabase';

export interface StreamingBlock {
  type: string;
  props: Record<string, unknown>;
}

export interface MicroProgress {
  stage: string;
  message: string;
  detail?: string;
}

export interface StreamingState {
  /** Accumulated json-render blocks (grows progressively as spec-block events arrive) */
  blocks: StreamingBlock[];
  /** The full json-render document (set to accumulated blocks, finalized on spec-complete) */
  document: StreamingBlock[] | null;
  /** Trip ID for the created/streaming trip */
  tripId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  /** Distinguishes reconnectable incomplete streams from hard failures. */
  errorKind: 'incomplete' | 'unauthorized' | 'failed' | null;
  progress: number;
  step: string;
  message: string;
  searchProgress: Record<string, string> | null;
  /** Top hotel from hotels agent (for display during streaming) */
  topHotel: Record<string, unknown> | null;
  /** Activity count from activities agent */
  activitiesCount: number;
  /** Dining count from dining agent */
  diningCount: number;
  /** Transport count from transport agent */
  transportCount: number;
  /** Hotel result count from the hotels agent (omit UI when 0) */
  hotelsCount: number;
  /** Itinerary days from aggregator */
  days: unknown[] | null;
  /** Micro-progress updates for granular feedback */
  microProgress: MicroProgress | null;
  /** History of micro-progress messages */
  microHistory: MicroProgress[];
}

export interface UseStreamingItineraryOptions {
  /** Trip ID to stream from the unified endpoint (if already created) */
  tripId?: string;
  /** Input to create a new trip + trigger generation (if no tripId) */
  input?: {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    travelerType: string;
    originCity?: string;
    originAirport?: string;
    vibes: string[];
    budget?: string;
  };
  streamingEnabled?: boolean;
  /**
   * Bump this value to force the hook to re-run its effect (e.g. on retry).
   * Included in the effect's dependency array; the value itself is not used.
   */
  retryKey?: number;
  onComplete?: (document: StreamingBlock[]) => void;
  onError?: (error: Error) => void;
}

const initialState: StreamingState = {
  blocks: [],
  document: null,
  tripId: null,
  isLoading: false,
  isStreaming: false,
  isComplete: false,
  error: null,
  errorKind: null,
  progress: 0,
  step: 'queued',
  message: 'Getting your trip started...',
  searchProgress: null,
  topHotel: null,
  activitiesCount: 0,
  diningCount: 0,
  transportCount: 0,
  hotelsCount: 0,
  days: null,
  microProgress: null,
  microHistory: [],
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function extractApiErrorMessage(body: string, fallback: string): string {
  const trimmed = body.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed);
    if (isObjectRecord(parsed)) {
      const error = parsed.error;
      if (typeof error === 'string' && error.trim()) {
        return error.trim();
      }

      const message = parsed.message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
  } catch {
    // Plain-text responses are handled below.
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('<!doctype') || lower.startsWith('<html')) {
    return fallback;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '');
  return extractApiErrorMessage(text, fallback);
}

function getTripIdFromCreateResponse(payload: unknown): string | null {
  if (!isObjectRecord(payload)) return null;
  const trip = payload.trip;
  if (!isObjectRecord(trip)) return null;
  return typeof trip.id === 'string' && trip.id.trim() ? trip.id : null;
}

export function getIncompleteStreamMessage(message: string): string {
  if (message.toLowerCase().includes('still generating')) {
    return 'Faroway is still planning in the background. Reconnect for updates.';
  }

  return 'The connection closed before your itinerary was ready. Reconnect to continue planning.';
}

export function isUnauthorizedStatus(status: number): boolean {
  return status === 401;
}

export const UNAUTHORIZED_GENERATE_MESSAGE = 'Sign in to generate your trip';
