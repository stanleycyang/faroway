"use client";

import dynamic from "next/dynamic";
import { MapLoading } from "@/components/trips/MapLoading";
import type { WorldMapAffiliateBundle } from "@/components/tools/world-map/world-map-affiliates";

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

export interface WorldMapClientProps {
  bundlesByCountryKey?: Record<string, WorldMapAffiliateBundle>;
  defaultLinks?: WorldMapAffiliateBundle;
}

export function WorldMapClient({
  bundlesByCountryKey,
  defaultLinks,
}: WorldMapClientProps = {}) {
  return (
    <WorldMapApp
      bundlesByCountryKey={bundlesByCountryKey}
      defaultLinks={defaultLinks}
    />
  );
}
