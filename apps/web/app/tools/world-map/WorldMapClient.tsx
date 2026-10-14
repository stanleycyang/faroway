"use client";

import dynamic from "next/dynamic";
import { MapLoading } from "@/components/trips/MapLoading";

const WorldMapApp = dynamic(
  () =>
    import("@/components/tools/world-map/WorldMapApp").then(
      (m) => m.WorldMapApp,
    ),
  {
    ssr: false,
    loading: () => <MapLoading />,
  },
);

export function WorldMapClient() {
  return <WorldMapApp />;
}
