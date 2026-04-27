"use client";

import { Share2, Sparkles, X } from "lucide-react";
import {
  MILESTONE_COPY,
  type Milestone,
} from "@/lib/tools/world-map/milestones";

interface Props {
  milestone: Milestone;
  onShare: () => void;
  onDismiss: () => void;
}

export function MilestoneToast({ milestone, onShare, onDismiss }: Props) {
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[55] w-[min(92vw,420px)] animate-slide-up">
      <div className="bg-gradient-to-br from-primary to-amber-500 text-white rounded-2xl shadow-2xl shadow-primary/30 ring-1 ring-white/20 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold tracking-tight flex items-center gap-2">
            <span>🎉 Milestone: {milestone} countries</span>
          </div>
          <div className="text-xs text-white/85 mt-0.5 leading-relaxed">
            {MILESTONE_COPY[milestone]}
          </div>
          <button
            type="button"
            onClick={onShare}
            className="mt-2.5 inline-flex items-center gap-1.5 bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/95 transition-colors shadow"
          >
            <Share2 className="w-3.5 h-3.5" /> Share your progress
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="w-7 h-7 rounded-lg text-white/80 hover:bg-white/10 flex items-center justify-center flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
