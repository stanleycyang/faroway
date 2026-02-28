/**
 * GET /api/destinations/trending
 * Returns destinations ranked by recent activity + season boost.
 * Query params: limit (default 10), offset (default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { popularDestinations } from "@faroway/constants";
import {
  type DestinationRow,
  normalizeDestination,
  computeTrendingScore,
  getCurrentSeason,
  getSeasonBoost,
} from "@/lib/destinations";
import type { DestinationInfo, DestinationsResponse } from "@faroway/types";
import { z } from "zod";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

function buildFallbackResponse(
  limit: number,
  offset: number,
): DestinationsResponse {
  // Use a rotated slice for trending to differentiate from popular
  const rotated = [
    ...popularDestinations.slice(5),
    ...popularDestinations.slice(0, 5),
  ];
  const sliced = rotated.slice(offset, offset + limit);
  return {
    destinations: sliced.map((d, i) => ({
      id: d.id,
      slug: d.id,
      name: d.name,
      country: d.country,
      description: d.description,
      image: d.image,
      tags: d.tags,
      seasons: { peak: [], good: [], off: [] },
      currency: d.currency,
      language: d.language,
      bestTime: d.bestTime,
      score: rotated.length - (offset + i),
    })),
    total: rotated.length,
    limit,
    offset,
  };
}

export async function GET(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request);
  const rl = checkRateLimit(`destinations-trending:${ip}`, {
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Parse query params
  const url = request.nextUrl;
  const parseResult = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { limit, offset } = parseResult.data;

  try {
    const supabase = getSupabase();

    // Fetch all destinations
    const { data: destinations, error: destError } = await supabase
      .from("destinations")
      .select("*");

    if (destError || !destinations || destinations.length === 0) {
      const fallback = buildFallbackResponse(limit, offset);
      return NextResponse.json(fallback, {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900",
        },
      });
    }

    // Recent = last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get recent trip counts via RPC
    const { data: tripCounts } = await supabase.rpc(
      "get_destination_trip_counts",
      { since },
    );

    // Get recent search counts via RPC
    const { data: searchCounts } = await supabase.rpc(
      "get_destination_search_counts",
      { since },
    );

    // Build lookup maps
    const tripMap = new Map<string, number>();
    if (tripCounts) {
      for (const row of tripCounts) {
        tripMap.set(row.destination_normalized, Number(row.trip_count));
      }
    }

    const searchMap = new Map<string, number>();
    if (searchCounts) {
      for (const row of searchCounts) {
        searchMap.set(row.destination_normalized, Number(row.search_count));
      }
    }

    const { month } = getCurrentSeason();

    // Score each destination
    const scored: (DestinationInfo & { _raw: DestinationRow })[] = (
      destinations as DestinationRow[]
    ).map((d) => {
      let recentTrips = tripMap.get(d.name_normalized) ?? 0;
      let recentSearches = searchMap.get(d.name_normalized) ?? 0;

      for (const alias of d.aliases) {
        const normAlias = normalizeDestination(alias);
        recentTrips += tripMap.get(normAlias) ?? 0;
        recentSearches += searchMap.get(normAlias) ?? 0;
      }

      const seasonBoost = getSeasonBoost(d.seasons ?? {}, month);
      const score = computeTrendingScore(
        recentTrips,
        recentSearches,
        seasonBoost,
      );

      const seasons = d.seasons ?? {};
      return {
        id: d.id,
        slug: d.slug,
        name: d.name,
        country: d.country,
        description: d.description ?? "",
        image: d.image ?? "",
        tags: d.tags ?? [],
        seasons: {
          peak: seasons.peak ?? [],
          good: seasons.good ?? [],
          off: seasons.off ?? [],
        },
        currency: d.currency ?? "",
        language: d.language ?? "",
        bestTime: d.best_time ?? "",
        score,
        tripCount: recentTrips,
        searchCount: recentSearches,
        _raw: d,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const total = scored.length;
    const paginated = scored.slice(offset, offset + limit);

    // Strip internal fields
    const results: DestinationInfo[] = paginated.map(
      ({
        id,
        slug,
        name,
        country,
        description,
        image,
        tags,
        seasons,
        currency,
        language,
        bestTime,
        score,
        tripCount,
        searchCount,
      }) => ({
        id,
        slug,
        name,
        country,
        description,
        image,
        tags,
        seasons,
        currency,
        language,
        bestTime,
        score,
        tripCount,
        searchCount,
      }),
    );

    const response: DestinationsResponse = {
      destinations: results,
      total,
      limit,
      offset,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    console.error("[Destinations Trending] Error:", error);

    const fallback = buildFallbackResponse(limit, offset);
    return NextResponse.json(fallback, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900",
      },
    });
  }
}
