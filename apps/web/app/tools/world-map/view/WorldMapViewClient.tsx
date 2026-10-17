"use client";

import dynamic from "next/dynamic";
import { MapLoading } from "@/components/trips/MapLoading";
import { useSearchParams } from "next/navigation";

const WorldMapView = dynamic(
  () =>
    import("@/components/tools/world-map/WorldMapView").then(
      (m) => m.WorldMapView,
    ),
  {
    ssr: false,
    loading: () => <MapLoading />,
  },
);

export function WorldMapViewClient() {
  const params = useSearchParams() ?? new URLSearchParams();
  const encoded = params.get("d");
  return <WorldMapView encoded={encoded} />;
}
