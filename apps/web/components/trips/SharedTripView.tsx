"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Copy, Sparkles } from "lucide-react";
import Image from "next/image";
import { TripHeader } from "@/components/trips/TripHeader";
import { ItineraryDay } from "@/components/trips/ItineraryDay";
import { ShareButtons } from "@/components/ShareButtons";
import { destinationImage } from "@/lib/trips/destination-image";
import type { TripDay } from "@/lib/ai/types";

function formatLabel(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

type ReactionKind = "thumbs_up" | "heart";
type ReactionCounts = Record<string, { thumbs_up: number; heart: number }>;
type UserVotes = Record<string, Partial<Record<ReactionKind, boolean>>>;

interface VotableStop {
  stopKey: string;
  name: string;
  slotLabel: string;
}

function slugifyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function extractDayVotableStops(day: TripDay): VotableStop[] {
  const stops: VotableStop[] = [];
  const slots: Array<{
    key: "morning" | "afternoon" | "evening";
    label: string;
    block: TripDay["morning"];
  }> = [
    { key: "morning", label: "Morning", block: day.morning },
    { key: "afternoon", label: "Afternoon", block: day.afternoon },
    { key: "evening", label: "Evening", block: day.evening },
  ];

  for (const slot of slots) {
    const activities = Array.isArray(slot.block?.activities)
      ? slot.block.activities
      : [];
    const blockRec = slot.block as unknown as Record<string, unknown>;
    const meals = Array.isArray(slot.block?.meals)
      ? slot.block.meals
      : blockRec?.meal && typeof blockRec.meal === "object"
        ? [blockRec.meal as TripDay["morning"]["meals"][number]]
        : [];

    activities.forEach((act, idx) => {
      if (!act || typeof act !== "object" || typeof act.name !== "string") {
        return;
      }
      const idSlug =
        slugifyKey(act.id || act.name || String(idx)) || String(idx);
      stops.push({
        stopKey: `d${day.dayNumber}-${slot.key}-a-${idx}-${idSlug}`,
        name: act.name,
        slotLabel: slot.label,
      });
    });

    meals.forEach((meal, idx) => {
      if (!meal || typeof meal !== "object" || typeof meal.name !== "string") {
        return;
      }
      const idSlug =
        slugifyKey(meal.id || meal.name || String(idx)) || String(idx);
      stops.push({
        stopKey: `d${day.dayNumber}-${slot.key}-m-${idx}-${idSlug}`,
        name: meal.name,
        slotLabel: slot.label,
      });
    });
  }

  return stops;
}

function buildCloneTripHref(params: {
  destination: string;
  travelers: number;
  budgetTier?: string;
  vibes?: string[];
}): string {
  const search = new URLSearchParams();
  if (params.destination.trim()) {
    search.set("destination", params.destination.trim());
  }
  if (Number.isFinite(params.travelers) && params.travelers > 0) {
    search.set("travelers", String(Math.round(params.travelers)));
  }
  if (params.budgetTier?.trim()) {
    search.set("budget", params.budgetTier.trim());
  }
  const cleanVibes = (params.vibes || [])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
  if (cleanVibes.length > 0) {
    search.set("vibes", cleanVibes.join(","));
  }
  const query = search.toString();
  return query ? `/create?${query}` : "/create";
}

function getOrCreateVoterId(): string {
  const storageKey = "faroway:shared-voter-id";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing && /^[a-zA-Z0-9_-]{4,80}$/.test(existing)) {
      return existing;
    }
    const generated = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

function readStoredVotes(token: string): UserVotes {
  try {
    const raw = window.localStorage.getItem(`faroway:shared-votes:${token}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as UserVotes;
  } catch {
    return {};
  }
}

function writeStoredVotes(token: string, votes: UserVotes): void {
  try {
    window.localStorage.setItem(
      `faroway:shared-votes:${token}`,
      JSON.stringify(votes),
    );
  } catch {
    // Ignore storage quota / private mode failures.
  }
}

interface SharedItinerary {
  days: TripDay[];
  overview: string;
  totalEstimatedCost?: {
    amount: number;
    currency: string;
  };
  packingList?: string[];
  generalTips?: string[];
  generatedAt: string;
}

interface SharedTripViewProps {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType?: string;
  vibes?: string[];
  budgetTier?: string;
  itinerary: SharedItinerary | null;
  shareToken: string;
  shareUrl: string;
}

export function SharedTripView({
  destination,
  startDate,
  endDate,
  travelers,
  travelerType,
  vibes,
  budgetTier,
  itinerary,
  shareToken,
  shareUrl,
}: SharedTripViewProps) {
  const heroImageUrl = destinationImage(destination);
  const cloneHref = useMemo(
    () =>
      buildCloneTripHref({
        destination,
        travelers,
        budgetTier,
        vibes,
      }),
    [destination, travelers, budgetTier, vibes],
  );

  const [counts, setCounts] = useState<ReactionCounts>({});
  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const userVotesRef = useRef<UserVotes>({});
  const activeTokenRef = useRef<string | null>(null);
  const voterIdRef = useRef<string | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    activeTokenRef.current = shareToken;
    pendingRef.current.clear();
    const controller = new AbortController();

    async function syncReactions() {
      voterIdRef.current = getOrCreateVoterId();
      const localVotes = readStoredVotes(shareToken);
      const seededCounts: ReactionCounts = {};
      for (const [stopKey, entry] of Object.entries(localVotes)) {
        if (entry?.thumbs_up || entry?.heart) {
          seededCounts[stopKey] = {
            thumbs_up: entry.thumbs_up ? 1 : 0,
            heart: entry.heart ? 1 : 0,
          };
        }
      }

      try {
        const res = await fetch(
          `/api/trips/shared/${encodeURIComponent(shareToken)}/reactions`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        const payload = res.ok
          ? ((await res.json()) as {
              counts?: ReactionCounts;
              persisted?: boolean;
            })
          : null;
        if (!active) return;

        userVotesRef.current = localVotes;
        setUserVotes(localVotes);
        if (payload?.counts) {
          const merged: ReactionCounts = { ...payload.counts };
          for (const [stopKey, entry] of Object.entries(localVotes)) {
            const current = merged[stopKey] || { thumbs_up: 0, heart: 0 };
            merged[stopKey] = {
              thumbs_up: entry?.thumbs_up
                ? Math.max(current.thumbs_up, 1)
                : current.thumbs_up,
              heart: entry?.heart ? Math.max(current.heart, 1) : current.heart,
            };
          }
          setCounts(merged);
        } else if (Object.keys(seededCounts).length > 0) {
          setCounts(seededCounts);
        }
      } catch {
        if (!active) return;
        userVotesRef.current = localVotes;
        setUserVotes(localVotes);
        if (Object.keys(seededCounts).length > 0) {
          setCounts(seededCounts);
        }
      }
    }

    void syncReactions();

    return () => {
      active = false;
      activeTokenRef.current = null;
      controller.abort();
    };
  }, [shareToken]);

  const handleToggleVote = useCallback(
    async (stopKey: string, reaction: ReactionKind) => {
      const requestToken = shareToken;
      const lockKey = `${requestToken}:${stopKey}:${reaction}`;
      if (pendingRef.current.has(lockKey)) return;
      pendingRef.current.add(lockKey);

      const currentVotes = userVotesRef.current;
      const wasVoted = Boolean(currentVotes[stopKey]?.[reaction]);
      const action: "add" | "remove" = wasVoted ? "remove" : "add";

      const nextVotes: UserVotes = {
        ...currentVotes,
        [stopKey]: {
          ...currentVotes[stopKey],
          [reaction]: !wasVoted,
        },
      };
      userVotesRef.current = nextVotes;
      setUserVotes(nextVotes);
      writeStoredVotes(requestToken, nextVotes);

      setCounts((prev) => {
        const current = prev[stopKey] || { thumbs_up: 0, heart: 0 };
        const delta = action === "add" ? 1 : -1;
        return {
          ...prev,
          [stopKey]: {
            ...current,
            [reaction]: Math.max(0, current[reaction] + delta),
          },
        };
      });

      try {
        const voterId = voterIdRef.current || getOrCreateVoterId();
        voterIdRef.current = voterId;
        const res = await fetch(
          `/api/trips/shared/${encodeURIComponent(requestToken)}/reactions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stopKey,
              reaction,
              action,
              voterId,
            }),
          },
        );
        if (activeTokenRef.current !== requestToken) return;
        if (res.ok) {
          const payload = (await res.json()) as {
            counts?: ReactionCounts;
            persisted?: boolean;
          };
          if (activeTokenRef.current !== requestToken) return;
          if (payload?.counts && payload.persisted) {
            setCounts(payload.counts);
          }
        }
      } catch {
        // Optimistic local state stays persisted in localStorage.
      } finally {
        pendingRef.current.delete(lockKey);
      }
    },
    [shareToken],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <TripHeader
        destination={destination}
        startDate={startDate}
        endDate={endDate}
        travelers={travelers}
        heroImageUrl={heroImageUrl}
        backUrl="/"
        showActions={false}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Trip Meta + Quick Clone CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {(travelerType || budgetTier || (vibes && vibes.length > 0)) && (
            <div className="flex flex-wrap gap-2">
              {travelerType && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-200/50">
                  {formatLabel(travelerType)}
                </span>
              )}
              {budgetTier && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-slate-100 text-slate-700 font-semibold">
                  {formatLabel(budgetTier)} tier
                </span>
              )}
              {vibes?.map((vibe) => (
                <span
                  key={vibe}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-primary-50 text-primary-700 ring-1 ring-primary-200/50"
                >
                  {formatLabel(vibe)}
                </span>
              ))}
            </div>
          )}

          <Link
            href={cloneHref}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm flex-shrink-0"
          >
            <Copy className="w-4 h-4" />
            Clone &amp; customize this trip
          </Link>
        </div>

        {/* Overview */}
        {itinerary?.overview && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Trip Overview
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {itinerary.overview}
            </p>
          </div>
        )}

        {itinerary?.days?.length ? (
          <p className="mb-4 text-sm text-gray-600">
            Prices shown are planning estimates. Confirm current prices, party
            size, taxes, fees and cancellation terms with each provider. No
            booking is confirmed by this plan.
          </p>
        ) : null}

        {/* Day-by-Day Itinerary */}
        {itinerary?.days && itinerary.days.length > 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">
              Day-by-Day Itinerary
            </h2>
            {itinerary.days.map((day) => {
              const votableStops = extractDayVotableStops(day);
              return (
                <div key={day.dayNumber} className="space-y-2.5">
                  <ItineraryDay
                    dayNumber={day.dayNumber}
                    date={day.date}
                    title={day.title}
                    summary={day.summary}
                    morning={day.morning}
                    afternoon={day.afternoon}
                    evening={day.evening}
                    tips={day.tips}
                    diningOptions={day.diningOptions}
                    timingProposal={day.timingProposal}
                    hotel={day.hotel}
                    transport={day.transport}
                    destination={destination}
                    vibes={vibes}
                    defaultExpanded={true}
                  />

                  {votableStops.length > 0 && (
                    <section
                      aria-label={`Vote on Day ${day.dayNumber} stops`}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-slate-700">
                          Vote on Day {day.dayNumber} stops
                        </p>
                        <span className="text-[11px] text-slate-500">
                          Tap to save favorites for your group
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {votableStops.map((stop) => {
                          const stopCounts = counts[stop.stopKey] || {
                            thumbs_up: 0,
                            heart: 0,
                          };
                          const votedUp = Boolean(
                            userVotes[stop.stopKey]?.thumbs_up,
                          );
                          const votedHeart = Boolean(
                            userVotes[stop.stopKey]?.heart,
                          );
                          return (
                            <div
                              key={stop.stopKey}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white pl-3 pr-1.5 py-1 text-xs shadow-xs"
                            >
                              <span
                                className="font-medium text-slate-800 max-w-[180px] truncate"
                                title={stop.name}
                              >
                                {stop.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleVote(stop.stopKey, "thumbs_up")
                                }
                                aria-pressed={votedUp}
                                aria-label={`Thumbs up ${stop.name}`}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${
                                  votedUp
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                <span aria-hidden="true">👍</span>
                                {stopCounts.thumbs_up > 0 && (
                                  <span>{stopCounts.thumbs_up}</span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleVote(stop.stopKey, "heart")
                                }
                                aria-pressed={votedHeart}
                                aria-label={`Love ${stop.name}`}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${
                                  votedHeart
                                    ? "bg-rose-600 text-white"
                                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                }`}
                              >
                                <span aria-hidden="true">❤️</span>
                                {stopCounts.heart > 0 && (
                                  <span>{stopCounts.heart}</span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* General Tips */}
        {itinerary?.generalTips && itinerary.generalTips.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl p-6 border border-primary-100/50">
            <h3 className="font-bold text-primary-800 mb-3 flex items-center gap-2">
              <span className="text-lg">💡</span> Travel Tips for {destination}
            </h3>
            <ul className="space-y-2">
              {itinerary.generalTips.map((tip, i) => (
                <li
                  key={i}
                  className="text-sm text-primary-700 flex items-start gap-2"
                >
                  <span className="text-primary-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Packing List */}
        {itinerary?.packingList && itinerary.packingList.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🧳</span> Packing Suggestions
            </h3>
            <div className="flex flex-wrap gap-2">
              {itinerary.packingList.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Share Section */}
        <div className="mt-8 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl p-6 sm:p-8 text-center border border-primary-100/30">
          <h3 className="font-bold text-gray-900 mb-2 text-lg">
            📤 Share This Trip
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Know someone who&apos;d love this itinerary? Spread the word!
          </p>
          <ShareButtons
            url={shareUrl}
            title={`${destination} Trip Itinerary`}
            description={`Check out this ${itinerary?.days?.length || ""}-day AI-generated itinerary to ${destination}! Created with Faroway.`}
            hashtags={["Faroway", "Travel", destination.replace(/\s+/g, "")]}
            className="justify-center"
          />
        </div>

        <div className="mt-6 text-center">
          <Link
            href={`/report?type=shared_trip&token=${encodeURIComponent(shareToken)}`}
            className="text-sm font-semibold text-gray-500 underline-offset-4 hover:text-gray-800 hover:underline"
          >
            Report this itinerary
          </Link>
        </div>

        {/* CTA Banner */}
        <div className="mt-8 bg-gradient-to-br from-primary to-primary-700 rounded-2xl p-8 sm:p-10 text-center text-white overflow-hidden relative">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 shadow-lg overflow-hidden">
              <Image
                src="/icon.png"
                alt="Faroway"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-black mb-3">
              Make This {destination} Trip Yours
            </h3>
            <p className="text-white/80 mb-6 max-w-md mx-auto leading-relaxed">
              Start with this trip&apos;s destination, party size, budget, and
              vibes — then tweak dates and stops in seconds.
            </p>
            <Link
              href={cloneHref}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary-700 rounded-full font-bold hover:bg-white/90 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5" />
              Clone &amp; customize this trip
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
