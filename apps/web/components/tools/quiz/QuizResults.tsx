'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, RotateCcw } from 'lucide-react';
import type { QuizResult } from '@/lib/tools/quiz-scoring';

interface QuizResultsProps {
  results: QuizResult[];
  onRestart: () => void;
}

const RANK_COLORS = [
  'from-amber-400 to-amber-500',
  'from-slate-300 to-slate-400',
  'from-amber-600 to-amber-700',
];

const RANK_LABELS = ['Best Match', '2nd Match', '3rd Match'];

export function QuizResults({ results, onRestart }: QuizResultsProps) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
          Your Perfect <span className="text-gradient">Destinations</span>
        </h2>
        <p className="text-slate-500 text-lg">
          Based on your travel style, here are your top matches
        </p>
      </div>

      <div className="space-y-6">
        {results.map((result, i) => (
          <div
            key={result.destination.slug}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div className="relative w-full md:w-64 h-48 md:h-auto flex-shrink-0">
                <Image
                  src={result.destination.cardImage}
                  alt={result.destination.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 256px"
                />
                <div className={`absolute top-3 left-3 px-3 py-1 rounded-full bg-gradient-to-r ${RANK_COLORS[i]} text-white text-xs font-bold shadow-lg`}>
                  {RANK_LABELS[i]}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {result.destination.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {result.destination.country}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {result.matchPercent}%
                    </div>
                    <p className="text-xs text-slate-500">match</p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {result.destination.tagline}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {result.matchReasons.map((reason) => (
                    <span
                      key={reason}
                      className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/create?destination=${result.destination.slug}`}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
                >
                  <Sparkles className="w-4 h-4" />
                  Plan My {result.destination.name} Trip
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Retake Quiz
        </button>
      </div>
    </div>
  );
}
