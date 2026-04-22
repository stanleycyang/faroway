"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const WorldMapView = dynamic(
  () =>
    import("@/components/tools/world-map/WorldMapView").then(
      (m) => m.WorldMapView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading map…</div>
      </div>
    ),
  },
);

export function WorldMapViewClient() {
  const params = useSearchParams();
  const encoded = params.get("d");
  return <WorldMapView encoded={encoded} />;
}
