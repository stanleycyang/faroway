'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, MapPin, Share2, Download, DollarSign, Sparkles } from 'lucide-react';

interface TripHeaderProps {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  totalCost?: {
    amount: number;
    currency: string;
  };
  status?: 'generating' | 'completed' | 'failed';
  onShare?: () => void;
  onExport?: () => void;
}

export function TripHeader({
  destination,
  startDate,
  endDate,
  travelers,
  totalCost,
  status = 'completed',
  onShare,
  onExport,
}: TripHeaderProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDuration = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Top Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Back</span>
          </Link>
          
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 hidden sm:inline">TripGenie</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={onShare}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share trip"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={onExport}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Export itinerary"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Trip Info */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-6">
        {/* Status Badge */}
        {status === 'generating' && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            AI is generating your itinerary...
          </div>
        )}
        
        {status === 'failed' && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm font-medium">
            <span>⚠️</span>
            Generation failed. Please try again.
          </div>
        )}

        {/* Destination */}
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <MapPin className="w-4 h-4" />
          <span>Destination</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          {destination}
        </h1>

        {/* Trip Meta */}
        <div className="flex flex-wrap gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(startDate)} - {formatDate(endDate)}
              </p>
              <p className="text-xs text-gray-500">
                {getDuration()} day{getDuration() > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {travelers} traveler{travelers > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500">Group size</p>
            </div>
          </div>

          {totalCost && totalCost.amount > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatCost(totalCost.amount, totalCost.currency)}
                </p>
                <p className="text-xs text-gray-500">Estimated total</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
