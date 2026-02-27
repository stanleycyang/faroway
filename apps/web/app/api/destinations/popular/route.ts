/**
 * GET /api/destinations/popular
 * Returns destinations ranked by all-time popularity score.
 * Query params: limit (default 10), offset (default 0), tags (comma-separated filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { popularDestinations } from '@faroway/constants';
import {
  type DestinationRow,
  normalizeDestination,
  computePopularScore,
} from '@/lib/destinations';
import type { DestinationInfo, DestinationsResponse } from '@faroway/types';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  tags: z.string().optional(),
});

function buildFallbackResponse(limit: number, offset: number, tags?: string[]): DestinationsResponse {
  let filtered = popularDestinations;
  if (tags && tags.length > 0) {
    filtered = filtered.filter((d) => d.tags.some((t) => tags.includes(t)));
  }
  const sliced = filtered.slice(offset, offset + limit);
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
      score: filtered.length - (offset + i),
    })),
    total: filtered.length,
    limit,
    offset,
  };
}

export async function GET(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request);
  const rl = checkRateLimit(`destinations-popular:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Parse query params
  const url = request.nextUrl;
  const parseResult = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
    tags: url.searchParams.get('tags') ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parseResult.error.issues },
      { status: 400 }
    );
  }

  const { limit, offset, tags: tagsRaw } = parseResult.data;
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

  try {
    const supabase = getSupabase();

    // Fetch all destinations
    const { data: destinations, error: destError } = await supabase
      .from('destinations')
      .select('*');

    if (destError || !destinations || destinations.length === 0) {
      // Fallback to hardcoded constants
      const fallback = buildFallbackResponse(limit, offset, tags);
      return NextResponse.json(fallback, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' },
      });
    }

    // Get all-time trip counts via RPC
    const { data: tripCounts } = await supabase.rpc('get_destination_trip_counts');

    // Get all-time search counts via RPC
    const { data: searchCounts } = await supabase.rpc('get_destination_search_counts');

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

    // Score each destination
    let scored: (DestinationInfo & { _raw: DestinationRow })[] = (destinations as DestinationRow[]).map((d) => {
      // Match counts by normalized name or aliases
      let tripCount = tripMap.get(d.name_normalized) ?? 0;
      let searchCount = searchMap.get(d.name_normalized) ?? 0;

      for (const alias of d.aliases) {
        const normAlias = normalizeDestination(alias);
        tripCount += tripMap.get(normAlias) ?? 0;
        searchCount += searchMap.get(normAlias) ?? 0;
      }

      const score = computePopularScore(tripCount, searchCount, d.base_popularity_score);

      const seasons = d.seasons ?? {};
      return {
        id: d.id,
        slug: d.slug,
        name: d.name,
        country: d.country,
        description: d.description ?? '',
        image: d.image ?? '',
        tags: d.tags ?? [],
        seasons: {
          peak: seasons.peak ?? [],
          good: seasons.good ?? [],
          off: seasons.off ?? [],
        },
        currency: d.currency ?? '',
        language: d.language ?? '',
        bestTime: d.best_time ?? '',
        score,
        tripCount,
        searchCount,
        _raw: d,
      };
    });

    // Filter by tags if provided
    if (tags && tags.length > 0) {
      scored = scored.filter((d) => d.tags.some((t) => tags.includes(t)));
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const total = scored.length;
    const paginated = scored.slice(offset, offset + limit);

    // Strip internal fields
    const results: DestinationInfo[] = paginated.map(
      ({ id, slug, name, country, description, image, tags, seasons, currency, language, bestTime, score, tripCount, searchCount }) =>
        ({ id, slug, name, country, description, image, tags, seasons, currency, language, bestTime, score, tripCount, searchCount })
    );

    const response: DestinationsResponse = {
      destinations: results,
      total,
      limit,
      offset,
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' },
    });
  } catch (error) {
    console.error('[Destinations Popular] Error:', error);

    // Fallback on any error
    const fallback = buildFallbackResponse(limit, offset, tags);
    return NextResponse.json(fallback, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' },
    });
  }
}
