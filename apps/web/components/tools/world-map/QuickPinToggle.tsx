"use client";

import { Zap } from "lucide-react";
import { useWorldMapStore } from "@/lib/tools/world-map/store";

export function QuickPinToggle() {
  const quickPin = useWorldMapStore((s) => s.settings.quickPin);
  const setQuickPin = useWorldMapStore((s) => s.setQuickPin);

  return (
    <button
      type="button"
      onClick={() => setQuickPin(!quickPin)}
      title={
        quickPin
          ? "Quick pin ON — click cycles status"
          : "Quick pin OFF — click opens drawer"
      }
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
        quickPin
          ? "bg-amber-400 text-amber-900 shadow-sm ring-1 ring-amber-500"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
      }`}
    >
      <Zap className={`w-3.5 h-3.5 ${quickPin ? "fill-current" : ""}`} />
      Quick pin
    </button>
  );
}
