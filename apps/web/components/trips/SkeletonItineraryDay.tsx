import React from "react";
import { Sunrise, Sun, Moon } from "lucide-react";

interface SkeletonItineraryDayProps {
  dayNumber: number;
  date?: string;
}

const dayColors = [
  { gradient: "from-primary to-primary-600", light: "from-primary-50/50" },
  { gradient: "from-violet-500 to-purple-600", light: "from-violet-50/50" },
  { gradient: "from-blue-500 to-indigo-600", light: "from-blue-50/50" },
  { gradient: "from-emerald-500 to-teal-600", light: "from-emerald-50/50" },
  { gradient: "from-amber-500 to-orange-600", light: "from-amber-50/50" },
  { gradient: "from-pink-500 to-rose-600", light: "from-pink-50/50" },
  { gradient: "from-cyan-500 to-blue-600", light: "from-cyan-50/50" },
];

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 ${className || ""}`} />
  );
}

function SkeletonActivityCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <ShimmerBar className="h-4 w-3/4" />
          <ShimmerBar className="h-3 w-full" />
          <ShimmerBar className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function SkeletonTimeBlock({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: "amber" | "orange" | "primary";
}) {
  const colorClasses = {
    amber:
      "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200",
    orange:
      "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200",
    primary:
      "bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 border-primary-200",
  };

  const dotColors = {
    amber: "bg-amber-400 ring-amber-100",
    orange: "bg-orange-400 ring-orange-100",
    primary: "bg-primary-400 ring-primary-100",
  };

  return (
    <div className="mb-8 last:mb-0 relative pl-10">
      <div
        className={`absolute left-[9px] top-1 w-3.5 h-3.5 rounded-full ${dotColors[color]} ring-4 z-10`}
      />
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-sm ${colorClasses[color]}`}
        >
          {icon}
          <span>{label}</span>
        </div>
      </div>
      <div className="space-y-3">
        <SkeletonActivityCard />
        <SkeletonActivityCard />
      </div>
    </div>
  );
}

export function SkeletonItineraryDay({
  dayNumber,
  date,
}: SkeletonItineraryDayProps) {
  const dayColor = dayColors[(dayNumber - 1) % dayColors.length];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Day Header */}
      <div
        className={`w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between bg-gradient-to-r ${dayColor.light} to-transparent`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${dayColor.gradient} flex flex-col items-center justify-center text-white flex-shrink-0 shadow-md`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider leading-none opacity-80">
              Day
            </span>
            <span className="text-2xl sm:text-3xl font-black leading-none">
              {dayNumber}
            </span>
          </div>
          <div className="text-left min-w-0">
            {date ? (
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                {formatDate(date)}
              </p>
            ) : (
              <ShimmerBar className="h-3 w-24 mb-1" />
            )}
            <ShimmerBar className="h-5 w-48 mt-1" />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <div className="px-4 sm:px-6 pb-6 border-t border-gray-100">
        {/* Summary shimmer */}
        <div className="mt-4 mb-6 space-y-2">
          <ShimmerBar className="h-3 w-full" />
          <ShimmerBar className="h-3 w-4/5" />
        </div>

        {/* Timeline with vertical connector */}
        <div className="relative">
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-300 via-orange-300 to-primary-300 rounded-full" />

          <SkeletonTimeBlock
            icon={<Sunrise className="w-4 h-4" />}
            label="Morning"
            color="amber"
          />
          <SkeletonTimeBlock
            icon={<Sun className="w-4 h-4" />}
            label="Afternoon"
            color="orange"
          />
          <SkeletonTimeBlock
            icon={<Moon className="w-4 h-4" />}
            label="Evening"
            color="primary"
          />
        </div>
      </div>
    </div>
  );
}
