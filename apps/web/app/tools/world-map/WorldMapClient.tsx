"use client";

import dynamic from "next/dynamic";

const WorldMapApp = dynamic(
  () =>
    import("@/components/tools/world-map/WorldMapApp").then(
      (m) => m.WorldMapApp,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading your map…</div>
      </div>
    ),
  },
);

export function WorldMapClient() {
  return <WorldMapApp />;
}
