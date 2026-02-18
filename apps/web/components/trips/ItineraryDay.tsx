'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sunrise, Sun, Moon, Lightbulb, DollarSign } from 'lucide-react';
import { ActivityCard, RestaurantCard, type Activity, type Restaurant } from './ActivityCard';

interface TimeBlock {
  activities: Activity[];
  meals: Restaurant[];
}

interface ItineraryDayProps {
  dayNumber: number;
  date: string;
  title: string;
  summary: string;
  morning: TimeBlock;
  afternoon: TimeBlock;
  evening: TimeBlock;
  totalEstimatedCost?: {
    amount: number;
    currency: string;
  };
  tips?: string[];
  defaultExpanded?: boolean;
}

export function ItineraryDay({
  dayNumber,
  date,
  title,
  summary,
  morning,
  afternoon,
  evening,
  totalEstimatedCost,
  tips,
  defaultExpanded = false,
}: ItineraryDayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasContent = (block: TimeBlock) => 
    block.activities.length > 0 || block.meals.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Day Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex flex-col items-center justify-center text-white flex-shrink-0">
            <span className="text-xs font-medium uppercase leading-none">Day</span>
            <span className="text-lg sm:text-xl font-bold leading-none">{dayNumber}</span>
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-sm text-gray-500">{formatDate(date)}</p>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {totalEstimatedCost && totalEstimatedCost.amount > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-sm text-gray-500">
              <DollarSign className="w-4 h-4" />
              <span>{formatCost(totalEstimatedCost.amount, totalEstimatedCost.currency)}</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-6 border-t border-gray-100">
          {/* Day Summary */}
          <p className="text-gray-600 text-sm mt-4 mb-6">{summary}</p>

          {/* Morning */}
          {hasContent(morning) && (
            <TimeBlockSection
              icon={<Sunrise className="w-4 h-4" />}
              label="Morning"
              color="amber"
              block={morning}
            />
          )}

          {/* Afternoon */}
          {hasContent(afternoon) && (
            <TimeBlockSection
              icon={<Sun className="w-4 h-4" />}
              label="Afternoon"
              color="orange"
              block={afternoon}
            />
          )}

          {/* Evening */}
          {hasContent(evening) && (
            <TimeBlockSection
              icon={<Moon className="w-4 h-4" />}
              label="Evening"
              color="indigo"
              block={evening}
            />
          )}

          {/* Daily Tips */}
          {tips && tips.length > 0 && (
            <div className="mt-6 p-4 bg-primary-50 rounded-xl">
              <div className="flex items-center gap-2 text-primary-700 font-medium mb-2">
                <Lightbulb className="w-4 h-4" />
                <span>Pro Tips</span>
              </div>
              <ul className="space-y-1">
                {tips.map((tip, i) => (
                  <li key={i} className="text-sm text-primary-700 flex items-start gap-2">
                    <span className="text-primary-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mobile cost display */}
          {totalEstimatedCost && totalEstimatedCost.amount > 0 && (
            <div className="sm:hidden mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">Day total</span>
              <span className="font-semibold text-gray-900">
                {formatCost(totalEstimatedCost.amount, totalEstimatedCost.currency)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TimeBlockSectionProps {
  icon: React.ReactNode;
  label: string;
  color: 'amber' | 'orange' | 'indigo';
  block: TimeBlock;
}

function TimeBlockSection({ icon, label, color, block }: TimeBlockSectionProps) {
  const colorClasses = {
    amber: 'bg-amber-100 text-amber-700',
    orange: 'bg-orange-100 text-orange-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <h4 className="font-semibold text-gray-800">{label}</h4>
      </div>
      
      <div className="space-y-3 ml-9">
        {block.activities.map((activity, idx) => (
          <ActivityCard key={activity.id} activity={activity} index={idx} />
        ))}
        {block.meals.map((meal) => (
          <RestaurantCard key={meal.id} restaurant={meal} />
        ))}
      </div>
    </div>
  );
}
