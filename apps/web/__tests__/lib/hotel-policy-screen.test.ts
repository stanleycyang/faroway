import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/sdk", () => ({
  generateObject: mocks.generateObject,
  gateway: (model: string) => model,
  createGateway: () => (model: string) => model,
}));
import { screenHotelCandidates } from "@/lib/search/hotel-policy-screen";
import { runHotelsAgent } from "@/lib/search/agents/hotels";
import { runAggregatorAgent } from "@/lib/search/agents/aggregator";
import { buildFallbackSearchPlan } from "@/lib/search/agents/orchestrator";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";
import facts from "../../../../scripts/fixtures/agentic-hotel-constraints.json";
import type { HotelResult } from "@/lib/search/types";
const plan = buildFallbackSearchPlan({
  destination: "Singapore",
  startDate: "2027-01-11",
  endDate: "2027-01-12",
  travelers: 4,
  adults: 2,
  children: 2,
  vibes: [],
});
const hotel = (
  id: string,
  name = "Heritage Collection on Chinatown",
  vibeScore = 100,
): HotelResult => ({
  id,
  name,
  description: "Generated idea",
  amenities: ["Elevator"],
  images: [],
  location: {
    name: "Singapore",
    address: "227 South Bridge Road",
    lat: 1.28,
    lng: 103.84,
  },
  vibeScore,
  vibeMatch: [],
  dataSource: "ai",
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("withholds policy or amenity conflicts without mutating candidates or certifying alternatives", () => {
  const input = [hotel("bad"), hotel("other", "Unreviewed hotel", 50)];
  const snapshot = structuredClone(input);
  const result = screenHotelCandidates(plan, input, facts);
  expect(result.candidates.map((h) => h.id)).toEqual(["other"]);
  expect(result.withheld[0].findings).toHaveLength(2);
  expect(result.suitabilityVerified).toBe(false);
  expect(input).toEqual(snapshot);
  expect(
    screenHotelCandidates({ ...plan, children: 0 }, [hotel("bad")], facts)
      .candidates,
  ).toHaveLength(0);
  expect(
    screenHotelCandidates(plan, [hotel("bad")], []).candidates,
  ).toHaveLength(1);
});

it("does not rewrite provider quotes, unknown provenance or another branch", () => {
  const provider = {
    ...hotel("provider"),
    dataSource: "provider" as const,
    pricePerNight: 123,
    currency: "SGD",
  };
  const legacy = { ...hotel("legacy"), dataSource: undefined };
  const other = hotel("other", "Heritage Collection on Clarke Quay");
  const result = screenHotelCandidates(plan, [provider, legacy, other], facts);
  expect(result.candidates).toEqual([provider, legacy, other]);
  expect(result.withheld).toHaveLength(0);
  expect(result.suitabilityVerified).toBe(false);
});

it("screens before agent results, hotel selection and saved mapping in the staging flow", async () => {
  for (const [key, value] of Object.entries({
    FAROWAY_SCHEDULE_EXPERIMENT: "compiled-narrated-v1",
    VERCEL_ENV: "preview",
    NEXT_PUBLIC_SUPABASE_URL: "https://omovikloadpvzijoaqus.supabase.co",
    PLANNING_THINKING_AGGREGATOR: "low",
  }))
    vi.stubEnv(key, value);
  mocks.generateObject.mockResolvedValue({
    object: { hotels: [hotel("bad"), hotel("other", "Unreviewed hotel", 50)] },
  });
  const hotels = await runHotelsAgent(plan);
  expect(hotels.map((h) => h.name)).toEqual(["Unreviewed hotel"]);
  const result = await runAggregatorAgent(plan, hotels, [], []);
  const mapped = mapSearchResultsToItinerary(
    {
      searchId: "screen",
      hotels,
      activities: [],
      dining: [],
      transport: [],
      itinerary: result.days,
    },
    result.topHotel,
  );
  expect(mapped.hotels).toEqual(hotels);
  expect(mapped.topHotel?.name).toBe("Unreviewed hotel");
  expect(mocks.generateObject).toHaveBeenCalledTimes(1);
  const withheld = await runAggregatorAgent(plan, [hotel("bad")], [], []);
  expect(withheld.topHotel).toBeNull();
  expect(withheld.days.every((day) => !day.hotel)).toBe(true);
  expect(withheld.days[0].tips.join(" ")).toContain(
    "No hotel has been selected",
  );
  expect(withheld.days[0].tips.join(" ")).toContain(facts[0].sourceUrl);
});

it("does not enable the experimental hotel screen in production", async () => {
  vi.stubEnv("FAROWAY_SCHEDULE_EXPERIMENT", "compiled-narrated-v1");
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.generateObject.mockResolvedValue({
    object: { hotels: [hotel("bad")] },
  });
  expect(await runHotelsAgent(plan)).toHaveLength(1);
});

it("does not turn check-in or shared-room age limits into a property-wide child ban", () => {
  const candidate = { ...hotel("conditional"), amenities: [] };
  for (const scope of ["check_in", "shared_rooms", undefined] as const) {
    const scopedFacts = facts.map((fact) => ({
      ...fact,
      agePolicyScope: scope,
    }));
    const result = screenHotelCandidates(plan, [candidate], scopedFacts);
    expect(result.candidates).toHaveLength(1);
    expect(result.suitabilityVerified).toBe(false);
  }
});

it("keeps stale policy visible for review without duplicating notices or mutating raw ideas", () => {
  const raw = hotel("stale");
  const first = screenHotelCandidates(plan, [raw], facts, "2026-11-30");
  expect(first.withheld).toHaveLength(0);
  expect(first.selectionCandidates).toHaveLength(0);
  expect(first.selectionPendingReview).toEqual(["stale"]);
  expect(first.reviewRequired[0].reason).toBe("source_review_due");
  expect(first.candidates[0].description).toContain("needs checking again");
  const second = screenHotelCandidates(
    plan,
    first.candidates,
    facts,
    "2026-11-30",
  );
  expect(second.candidates[0].description).toBe(
    first.candidates[0].description,
  );
  expect(raw.description).toBe("Generated idea");
  expect(second.suitabilityVerified).toBe(false);
});

it("carries scoped policy review into the draft instead of rejecting a family-friendly room option", async () => {
  for (const [key, value] of Object.entries({
    FAROWAY_SCHEDULE_EXPERIMENT: "compiled-narrated-v1",
    VERCEL_ENV: "preview",
    NEXT_PUBLIC_SUPABASE_URL: "https://omovikloadpvzijoaqus.supabase.co",
    PLANNING_THINKING_AGGREGATOR: "low",
  }))
    vi.stubEnv(key, value);
  const candidate = hotel("scoped", "Steel House Copenhagen");
  const result = await runAggregatorAgent(
    { ...plan, destination: "Copenhagen" },
    [candidate],
    [],
    [],
  );
  expect(result.topHotel?.name).toBe(candidate.name);
  expect(result.topHotel?.description).toContain(
    "exact room and check-in arrangement",
  );
  expect(result.days[0].tips.join(" ")).toContain(
    "Check the age rules for the exact room",
  );
  expect(result.days[0].tips.join(" ")).toContain(facts[1].sourceUrl);
});

it("does not automatically select a previously conflicted hotel when its evidence expires", async () => {
  vi.setSystemTime(new Date("2026-11-30T12:00:00Z"));
  for (const [key, value] of Object.entries({
    FAROWAY_SCHEDULE_EXPERIMENT: "compiled-narrated-v1",
    VERCEL_ENV: "preview",
    NEXT_PUBLIC_SUPABASE_URL: "https://omovikloadpvzijoaqus.supabase.co",
    PLANNING_THINKING_AGGREGATOR: "low",
  }))
    vi.stubEnv(key, value);
  const raw = hotel("expired");
  const result = await runAggregatorAgent(plan, [raw], [], []);
  expect(result.topHotel).toBeNull();
  expect(result.days.every((day) => !day.hotel)).toBe(true);
  expect(result.days[0].tips.join(" ")).toContain("needs checking again");
  expect(result.days[0].tips.join(" ")).toContain("No hotel has been selected");
});
