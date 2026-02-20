import type { MonthlyClimate } from '@/lib/tools/climate-data';
import { Droplets } from 'lucide-react';

interface MonthlyClimateChartProps {
  months: MonthlyClimate[];
}

export function MonthlyClimateChart({ months }: MonthlyClimateChartProps) {
  const maxTemp = Math.max(...months.map((m) => m.avgTempC));
  const minTemp = Math.min(...months.map((m) => m.avgTempC));
  const range = maxTemp - minTemp || 1;
  const maxRainfall = Math.max(...months.map((m) => m.rainfallMm)) || 1;

  const BAR_AREA_HEIGHT = 160; // px — the actual bar drawing area

  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200/80">
      {/* Legend */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900">
          Monthly Climate
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-primary to-amber-400" />
            Temperature
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3 h-3 text-sky-400" />
            Rainfall
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        {months.map((m) => {
          const tempNorm = (m.avgTempC - minTemp) / range; // 0-1
          const barHeight = Math.round(tempNorm * (BAR_AREA_HEIGHT - 30) + 30); // min 30px
          const rainNorm = m.rainfallMm / maxRainfall;
          const rainHeight = Math.round(rainNorm * (BAR_AREA_HEIGHT - 10) + 4);

          // Color: blue for cold, coral-amber for warm
          const barColor =
            tempNorm > 0.65
              ? 'from-primary to-amber-400'
              : tempNorm > 0.35
                ? 'from-amber-300 to-primary'
                : 'from-sky-300 to-blue-400';

          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
              {/* Temp label */}
              <span className="text-[10px] sm:text-xs font-semibold text-slate-700">
                {m.avgTempC}°
              </span>

              {/* Bars container */}
              <div
                className="relative w-full flex items-end justify-center gap-0.5"
                style={{ height: `${BAR_AREA_HEIGHT}px` }}
              >
                {/* Temperature bar */}
                <div
                  className={`w-1/2 rounded-t-md bg-gradient-to-t ${barColor} transition-all`}
                  style={{ height: `${barHeight}px` }}
                />
                {/* Rainfall bar */}
                <div
                  className="w-1/2 rounded-t-md bg-sky-200 transition-all"
                  style={{ height: `${rainHeight}px` }}
                />

                {/* Hover tooltip */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                  <div className="bg-slate-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    <p className="font-semibold">{m.avgTempC}°C / {m.avgTempF}°F</p>
                    <p className="text-slate-300">{m.rainfallMm}mm rain</p>
                  </div>
                  <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
                </div>
              </div>

              {/* Month label */}
              <span className="text-[10px] sm:text-xs text-slate-500 font-medium">
                {m.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
