import type { Metadata } from "next";
import { Suspense } from "react";
import { decodeProfileFromUrl } from "@/lib/tools/world-map/share";
import { computeStats } from "@/lib/tools/world-map/stats";
import { WorldMapViewClient } from "./WorldMapViewClient";

type SearchParams = Promise<{ d?: string | string[] }>;

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const d = firstString(sp.d);

  let title = "Shared World Map — Faroway";
  let description =
    "A shared read-only view of a traveler's world map. Make your own at faroway.ai/tools/world-map.";

  if (d) {
    const decoded = decodeProfileFromUrl(d);
    if (decoded) {
      const stats = computeStats(decoded.visits);
      title = `${decoded.name}'s World Map — ${stats.totalVisited} ${
        stats.totalVisited === 1 ? "country" : "countries"
      }`;
      description = `${decoded.name} has been to ${stats.totalVisited} ${
        stats.totalVisited === 1 ? "country" : "countries"
      } across ${stats.continentsVisited} continent${
        stats.continentsVisited === 1 ? "" : "s"
      }. Can you beat that? Make your own map — no sign-up.`;
    }
  }

  const ogUrl = d
    ? `/api/og/world-map?d=${encodeURIComponent(d)}`
    : `/api/og/world-map`;

  return {
    title,
    description,
    alternates: { canonical: "/tools/world-map/view" },
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

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
