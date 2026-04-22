import type { Metadata } from "next";
import { Suspense } from "react";
import { WorldMapViewClient } from "./WorldMapViewClient";

export const metadata: Metadata = {
  title: "Shared World Map",
  description:
    "A shared read-only view of a traveler's world map, encoded directly in the link.",
  alternates: { canonical: "/tools/world-map/view" },
  robots: { index: false, follow: true },
};

export default function WorldMapViewPage() {
  return (
    <main className="min-h-screen pt-20 lg:pt-24 pb-16">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-slate-400 text-sm">Loading map…</div>
          </div>
        }
      >
        <WorldMapViewClient />
      </Suspense>
    </main>
  );
}
