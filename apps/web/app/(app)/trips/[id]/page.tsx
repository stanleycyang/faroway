'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, MapPin, RefreshCw, Sparkles } from 'lucide-react';
import { TripHeader } from '@/components/trips/TripHeader';
import { ItineraryDay } from '@/components/trips/ItineraryDay';
import { ShareButtons } from '@/components/ShareButtons';
import type { GeneratedItinerary, TripDay } from '@/lib/ai/types';

interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  traveler_type?: string;
  vibes?: string[];
  status: 'draft' | 'generating' | 'completed' | 'failed';
  workflow_id?: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowStatus {
  workflowId: string;
  tripId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  step: string;
  message: string;
  startedAt: string;
  completedAt?: string;
  result?: {
    itineraryId?: string;
    error?: string;
  };
}

interface TripResponse {
  trip: Trip;
  itinerary?: GeneratedItinerary;
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch trip data
  const fetchTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/login?redirectTo=/trips/' + tripId);
          return;
        }
        throw new Error('Failed to fetch trip');
      }
      const data: TripResponse = await res.json();
      setTrip(data.trip);
      if (data.itinerary) {
        setItinerary(data.itinerary);
      }
      return data.trip;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
      return null;
    } finally {
      setLoading(false);
    }
  }, [tripId, router]);

  // Poll workflow status
  const pollWorkflowStatus = useCallback(async (workflowId: string) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/status`);
      if (!res.ok) return null;
      const status: WorkflowStatus = await res.json();
      setWorkflowStatus(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Polling for generation status
  useEffect(() => {
    if (!trip?.workflow_id || trip.status === 'completed' || trip.status === 'failed') {
      return;
    }

    // Initial poll
    pollWorkflowStatus(trip.workflow_id);

    // Set up polling interval
    const interval = setInterval(async () => {
      const status = await pollWorkflowStatus(trip.workflow_id!);
      
      if (status?.status === 'completed' || status?.status === 'failed') {
        clearInterval(interval);
        // Refetch trip to get updated data
        await fetchTrip();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [trip?.workflow_id, trip?.status, pollWorkflowStatus, fetchTrip]);

  const handleShare = () => {
    // Placeholder - will implement sharing later
    if (navigator.share) {
      navigator.share({
        title: `Trip to ${trip?.destination}`,
        text: `Check out my trip itinerary to ${trip?.destination}!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleExport = () => {
    // Placeholder - will implement export later
    alert('Export feature coming soon!');
  };

  const handleRetry = async () => {
    // Placeholder - will implement retry later
    alert('Retry feature coming soon!');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading trip...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Trip not found</h1>
          <p className="text-gray-600 mb-6">{error || 'This trip may have been deleted or you may not have access to it.'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tripStatus = trip.status === 'generating' || (workflowStatus && workflowStatus.status !== 'completed' && workflowStatus.status !== 'failed')
    ? 'generating'
    : trip.status === 'failed' || workflowStatus?.status === 'failed'
    ? 'failed'
    : 'completed';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Trip Header */}
      <TripHeader
        destination={trip.destination}
        startDate={trip.start_date}
        endDate={trip.end_date}
        travelers={trip.travelers}
        totalCost={itinerary?.totalEstimatedCost}
        status={tripStatus}
        onShare={handleShare}
        onExport={handleExport}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Generation Progress */}
        {tripStatus === 'generating' && workflowStatus && (
          <GenerationProgress status={workflowStatus} />
        )}

        {/* Generation Failed */}
        {tripStatus === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-800 mb-1">Generation Failed</h3>
                <p className="text-sm text-red-700 mb-4">
                  {workflowStatus?.result?.error || 'Something went wrong while generating your itinerary. Please try again.'}
                </p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overview Section */}
        {itinerary?.overview && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Trip Overview</h2>
            <p className="text-gray-600">{itinerary.overview}</p>
          </div>
        )}

        {/* Map Placeholder */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="h-48 sm:h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center">
            <MapPin className="w-10 h-10 text-gray-400 mb-2" />
            <p className="text-gray-500 font-medium">Interactive Map</p>
            <p className="text-sm text-gray-400">Coming soon</p>
          </div>
        </div>

        {/* Day-by-Day Itinerary */}
        {itinerary?.days && itinerary.days.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Day-by-Day Itinerary</h2>
            {itinerary.days.map((day, index) => (
              <ItineraryDay
                key={day.dayNumber}
                dayNumber={day.dayNumber}
                date={day.date}
                title={day.title}
                summary={day.summary}
                morning={day.morning}
                afternoon={day.afternoon}
                evening={day.evening}
                totalEstimatedCost={day.totalEstimatedCost}
                tips={day.tips}
                defaultExpanded={index === 0}
              />
            ))}
          </div>
        ) : tripStatus === 'completed' ? (
          <EmptyItinerary destination={trip.destination} />
        ) : null}

        {/* General Tips */}
        {itinerary?.generalTips && itinerary.generalTips.length > 0 && (
          <div className="mt-6 bg-primary-50 rounded-2xl p-6">
            <h3 className="font-semibold text-primary-800 mb-3">💡 Travel Tips for {trip.destination}</h3>
            <ul className="space-y-2">
              {itinerary.generalTips.map((tip, i) => (
                <li key={i} className="text-sm text-primary-700 flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Packing List */}
        {itinerary?.packingList && itinerary.packingList.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3">🧳 Packing Suggestions</h3>
            <div className="flex flex-wrap gap-2">
              {itinerary.packingList.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Share This Trip */}
        {tripStatus === 'completed' && itinerary && (
          <div className="mt-8 bg-gradient-to-r from-primary-50 to-purple-50 rounded-2xl p-6 text-center">
            <h3 className="font-semibold text-gray-900 mb-2">📤 Share Your Adventure</h3>
            <p className="text-sm text-gray-600 mb-4">Let friends and family know about your upcoming trip!</p>
            <ShareButtons
              title={`My ${trip.destination} Trip Itinerary`}
              description={`Check out my ${itinerary.days?.length || ''}-day AI-generated itinerary to ${trip.destination}! Created with TripGenie.`}
              hashtags={['TripGenie', 'Travel', trip.destination.replace(/\s+/g, '')]}
              className="justify-center"
            />
          </div>
        )}
      </main>
    </div>
  );
}

interface GenerationProgressProps {
  status: WorkflowStatus;
}

function GenerationProgress({ status }: GenerationProgressProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Creating Your Itinerary</h3>
          <p className="text-sm text-gray-600">{status.message}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.max(5, status.progress)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500">{status.step}</span>
          <span className="text-xs text-gray-500">{status.progress}%</span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {['Research', 'Planning', 'Finalizing'].map((step, i) => {
          const stepProgress = i === 0 ? 33 : i === 1 ? 66 : 100;
          const isActive = status.progress >= stepProgress - 33 && status.progress < stepProgress;
          const isComplete = status.progress >= stepProgress;
          
          return (
            <div
              key={step}
              className={`text-center p-2 rounded-lg ${
                isActive ? 'bg-primary-50' : isComplete ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              <div className={`text-lg mb-1 ${isActive ? 'animate-bounce' : ''}`}>
                {isComplete ? '✅' : i === 0 ? '🔍' : i === 1 ? '📝' : '✨'}
              </div>
              <p className={`text-xs font-medium ${
                isActive ? 'text-primary-700' : isComplete ? 'text-green-700' : 'text-gray-500'
              }`}>
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EmptyItineraryProps {
  destination: string;
}

function EmptyItinerary({ destination }: EmptyItineraryProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <MapPin className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Itinerary Yet</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Your trip to {destination} doesn&apos;t have an itinerary yet. Generate one with our AI planner!
      </p>
      <Link
        href={`/create?destination=${encodeURIComponent(destination)}`}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-colors"
      >
        <Sparkles className="w-5 h-5" />
        Generate Itinerary
      </Link>
    </div>
  );
}
