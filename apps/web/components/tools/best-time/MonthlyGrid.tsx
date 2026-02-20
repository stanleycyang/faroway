import type { MonthlyClimate } from '@/lib/tools/climate-data';
import { Droplets } from 'lucide-react';

interface MonthlyGridProps {
  months: MonthlyClimate[];
}

const SEASON_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  peak: { label: 'Peak', bg: 'bg-primary/10', text: 'text-primary' },
  shoulder: { label: 'Shoulder', bg: 'bg-amber-50', text: 'text-amber-600' },
  off: { label: 'Off-Season', bg: 'bg-slate-100', text: 'text-slate-500' },
};

export function MonthlyGrid({ months }: MonthlyGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {months.map((m) => {
        const season = SEASON_STYLES[m.season];
        return (
          <div
            key={m.month}
            className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-bold text-slate-900">{m.month}</h4>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${season.bg} ${season.text}`}
              >
                {season.label}
              </span>
            </div>

            <div className="space-y-2">
              {/* Temperature */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Temp</span>
                <span className="text-sm font-semibold text-slate-900">
                  {m.avgTempC}°C / {m.avgTempF}°F
                </span>
              </div>

              {/* Rainfall */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Droplets className="w-3 h-3" /> Rain
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {m.rainfallMm}mm
                </span>
              </div>

              {/* Crowd level */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Crowds</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`w-2.5 h-2.5 rounded-full ${
                        level <= m.crowdLevel
                          ? 'bg-primary'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Events */}
              {m.events.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  {m.events.map((event) => (
                    <p
                      key={event}
                      className="text-xs text-slate-500 truncate"
                    >
                      {event}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
