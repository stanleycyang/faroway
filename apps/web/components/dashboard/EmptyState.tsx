import Link from "next/link";
import { Sparkles, MapPin, Calendar, Compass } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  showCTA?: boolean;
}

export function EmptyState({
  title = "No trips yet",
  description = "Tell us what you have in mind. We’ll shape the places, stays, and little discoveries into a journey that feels like you.",
  showCTA = true,
}: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-12 text-center sm:px-12">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </div>

      {/* Content */}
      <h3 className="font-editorial text-3xl text-slate-900 mb-3">{title}</h3>
      <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {/* CTA */}
      {showCTA && (
        <div className="space-y-4">
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            Create Your First Trip
          </Link>

          {/* Quick Start Guide */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-4">
              How it works:
            </p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Choose destination
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Where do you want to go?
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Pick dates
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    When are you traveling?
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    Get itinerary
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    AI creates your plan!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
