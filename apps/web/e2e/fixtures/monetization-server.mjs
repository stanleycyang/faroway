// Test-only local backend for monetization API route E2E tests.
// Uses dedicated ports 4410 (Next) and 4411 (loopback Supabase + mock Viator API).
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  cpSync,
  mkdtempSync,
  symlinkSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

for (const file of [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
]) {
  if (existsSync(file) || existsSync(path.join("../..", file))) {
    throw new Error(
      "Monetization route tests require a workspace without dotenv files",
    );
  }
}

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const DEFAULT_E2E_AUTH_USER_ID =
  process.env.E2E_AUTH_USER_ID || "11111111-1111-4111-8111-111111111111";
const DEFAULT_E2E_SHARED_TRIP_TOKEN =
  process.env.E2E_SHARED_TRIP_TOKEN || "e2e-shared-tokyo-token";
const DEFAULT_E2E_OWNED_TRIP_ID =
  process.env.E2E_OWNED_TRIP_ID || "44444444-4444-4444-4444-444444444444";
const DEFAULT_E2E_SEARCH_ID = "55555555-5555-4555-8555-555555555555";

function createSeededBlogPosts() {
  return [
    {
      id: "blog-post-tokyo-guide",
      slug: "tokyo-travel-guide-and-itinerary",
      title: "Tokyo Travel Guide: 5 Days of Culture, Ramen & Hidden Temples",
      description:
        "Plan an unforgettable Tokyo itinerary with boutique stays, neighborhood walks, and day trips across Japan.",
      author_slug: "faroway-team",
      category: "Destinations",
      tags: ["tokyo", "japan", "culture"],
      cover_image: "/icon.png",
      cover_image_alt: "Tokyo Travel Guide",
      reading_time: 6,
      featured: true,
      cluster: null,
      published_at: "2026-10-15T08:00:00.000Z",
      last_updated: "2026-10-15T08:00:00.000Z",
      view_count: 42,
      status: "published",
      content: [
        "## Exploring Tokyo",
        "",
        "Tokyo blends centuries-old shrines with modern neighborhoods. Book central hotels early and reserve guided cultural walks in advance.",
        "",
        "### Getting Around",
        "",
        "Pick up an IC transit card and stay connected with a local eSIM.",
      ].join("\n"),
    },
    {
      id: "blog-post-budget-money-guide",
      slug: "travel-budget-wise-currency-insurance-guide",
      title:
        "Travel Budget & Money Guide: Currency, Cards, and Coverage in Japan",
      description:
        "How to manage foreign exchange fees, travel medical insurance, and daily costs in Tokyo and beyond.",
      author_slug: "faroway-team",
      category: "Money",
      tags: ["finance", "budget", "wise", "tokyo"],
      cover_image: "/icon.png",
      cover_image_alt: "Travel Budget and Money Guide",
      reading_time: 5,
      featured: false,
      cluster: null,
      published_at: "2026-10-10T08:00:00.000Z",
      last_updated: "2026-10-10T08:00:00.000Z",
      view_count: 18,
      status: "published",
      content: [
        "## Smart Travel Money",
        "",
        "Avoid airport currency booths and compare mid-market rates before departing for Japan.",
        "",
        "### Protection Abroad",
        "",
        "Consider flexible travel medical coverage alongside low-fee multi-currency spending.",
      ].join("\n"),
    },
  ];
}

function createIntegratedSeedData() {
  const sharedTrip = {
    id: "66666666-6666-4666-8666-666666666666",
    user_id: DEFAULT_E2E_AUTH_USER_ID,
    destination: "Tokyo, Japan",
    start_date: "2099-07-10",
    end_date: "2099-07-12",
    travelers: 2,
    budget_tier: "moderate",
    status: "planned",
    preferences: { travelerType: "couple" },
    vibes: ["culture", "foodie"],
    interests: [],
    is_shared: true,
    share_token: DEFAULT_E2E_SHARED_TRIP_TOKEN,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-03T00:00:00.000Z",
    itineraries: [
      {
        id: "77777777-7777-4777-8777-777777777771",
        days: [
          {
            dayNumber: 1,
            date: "2099-07-10",
            title: "Asakusa & Traditional Tokyo",
            summary: "Historic temples, street food, and riverside views.",
            morning: {
              activities: [
                {
                  id: "act_gyg_sensoji",
                  name: "Senso-ji Morning Cultural Walk",
                  description: "Guided walk through Asakusa and Senso-ji.",
                  duration: 120,
                  estimatedCost: { amount: 45, currency: "USD" },
                  timeOfDay: "morning",
                  category: "cultural",
                  location: {
                    name: "Senso-ji Temple",
                    address: "Asakusa, Tokyo",
                  },
                  bookingInfo: {
                    requiresReservation: true,
                    affiliateId: "getyourguide",
                    bookingUrl:
                      "https://www.getyourguide.com/tokyo-l193/sensoji-walk-t12345/?partner_id=FAROWAY",
                  },
                },
              ],
              meals: [
                {
                  id: "meal_ramen_1",
                  name: "Asakusa Ramen House",
                  cuisineType: ["Japanese", "Ramen"],
                  priceLevel: 2,
                  description: "Rich Tokyo-style ramen near Asakusa.",
                  estimatedCost: {
                    amount: 18,
                    currency: "USD",
                    perPerson: true,
                  },
                  mealType: "lunch",
                  location: { name: "Asakusa", address: "Tokyo" },
                  dietaryOptions: [],
                  reservationInfo: {
                    recommended: true,
                    url: "https://www.opentable.com/r/asakusa-ramen-tokyo",
                  },
                },
              ],
            },
            afternoon: { activities: [], meals: [] },
            evening: { activities: [], meals: [] },
          },
        ],
        overview: "A curated two-day Tokyo cultural and culinary getaway.",
        total_cost: { amount: 1850, currency: "USD" },
        packing_list: ["Comfortable walking shoes", "Compact umbrella"],
        general_tips: ["Use an IC transit card for subways across Tokyo."],
        generated_at: "2026-10-03T00:00:00.000Z",
      },
    ],
  };

  const ownedTrip = {
    id: DEFAULT_E2E_OWNED_TRIP_ID,
    user_id: DEFAULT_E2E_AUTH_USER_ID,
    destination: "Tokyo, Japan",
    start_date: "2099-07-10",
    end_date: "2099-07-12",
    travelers: 2,
    budget_tier: "moderate",
    status: "planned",
    search_id: DEFAULT_E2E_SEARCH_ID,
    preferences: { originAirport: "SFO" },
    vibes: ["culture", "foodie"],
    interests: [],
    is_shared: false,
    share_token: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-03T00:00:00.000Z",
    itineraries: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        booking_generation_id: "88888888-8888-4888-8888-888888888888",
        days: [
          {
            dayNumber: 1,
            date: "2099-07-10",
            title: "Arrival & Imperial Tokyo",
            summary:
              "Settle in, explore Imperial Gardens, and dine in Minato.",
            morning: {
              activities: [
                {
                  id: "activity_v_123P1",
                  name: "Tokyo Imperial Garden Guided Tour",
                  description:
                    "Guided cultural walk through the Imperial Palace East Gardens.",
                  duration: 120,
                  estimatedCost: { amount: 65, currency: "USD" },
                  timeOfDay: "morning",
                  category: "cultural",
                  location: {
                    name: "Imperial Palace East Gardens",
                    address: "Chiyoda, Tokyo",
                  },
                  bookingInfo: {
                    requiresReservation: true,
                    affiliateId: "viator",
                  },
                  viatorContentVersion: 1,
                },
                {
                  id: "act_gyg_tokyo",
                  name: "Meiji Shrine & Harajuku Walk",
                  description:
                    "Morning stroll through Meiji Jingu forest and Harajuku.",
                  duration: 90,
                  estimatedCost: { amount: 40, currency: "USD" },
                  timeOfDay: "morning",
                  category: "sightseeing",
                  location: { name: "Meiji Jingu", address: "Shibuya, Tokyo" },
                  bookingInfo: {
                    requiresReservation: true,
                    affiliateId: "getyourguide",
                    bookingUrl:
                      "https://www.getyourguide.com/tokyo-l193/meiji-shrine-t67890/?partner_id=FAROWAY",
                  },
                },
              ],
              meals: [
                {
                  id: "meal_tokyo_1",
                  name: "Narisawa Tokyo",
                  cuisineType: ["Japanese"],
                  priceLevel: 4,
                  description: "Innovative seasonal dining in Minato.",
                  estimatedCost: {
                    amount: 180,
                    currency: "USD",
                    perPerson: true,
                  },
                  mealType: "dinner",
                  location: { name: "Minato", address: "Tokyo" },
                  dietaryOptions: [],
                  reservationInfo: {
                    recommended: true,
                    url: "https://www.opentable.com/r/narisawa-tokyo?rid=555",
                  },
                },
              ],
            },
            afternoon: { activities: [], meals: [] },
            evening: { activities: [], meals: [] },
            hotel: {
              id: "hotel_tokyo_1",
              name: "Park Hotel Tokyo",
              address: "Shiodome, Tokyo",
              affiliatePartner: "stay22",
              affiliateUrl:
                "https://www.stay22.com/allez/roam?aid=faroway&address=Park+Hotel+Tokyo",
              pricePerNight: 240,
              currency: "USD",
              rating: 4.6,
            },
            transport: {
              id: "flight_outbound_1",
              type: "flight",
              provider: "ANA",
              departure: {
                airport: "SFO",
                city: "San Francisco",
                dateTime: "2099-07-10T11:30:00",
              },
              arrival: {
                airport: "HND",
                city: "Tokyo",
                dateTime: "2099-07-11T14:45:00",
              },
              duration: 675,
              stops: 0,
              price: 980,
              currency: "USD",
              affiliatePartner: "duffel",
              affiliateUrl:
                "https://book.duffel.com/flights/SFO-HND?reference=outbound1",
              quotedAt: "2099-07-01T00:00:00.000Z",
              expiresAt: "2099-07-10T00:00:00.000Z",
            },
          },
          {
            dayNumber: 2,
            date: "2099-07-12",
            title: "Shibuya & Departure",
            summary: "Panoramic skyline views before heading to Haneda.",
            morning: {
              activities: [
                {
                  id: "act_shibuya_sky",
                  name: "Shibuya Sky Observation",
                  description: "Open-air observation deck above Shibuya.",
                  duration: 90,
                  estimatedCost: { amount: 25, currency: "USD" },
                  timeOfDay: "morning",
                  category: "sightseeing",
                  location: {
                    name: "Shibuya Scramble Square",
                    address: "Shibuya, Tokyo",
                  },
                  bookingInfo: {
                    requiresReservation: true,
                    affiliateId: "klook",
                    bookingUrl:
                      "https://www.klook.com/activity/123-tokyo/?aid=111",
                  },
                },
              ],
              meals: [],
            },
            afternoon: { activities: [], meals: [] },
            evening: { activities: [], meals: [] },
            transport: {
              id: "flight_outbound_1__return",
              type: "flight",
              provider: "ANA",
              departure: {
                airport: "HND",
                city: "Tokyo",
                dateTime: "2099-07-12T17:00:00",
              },
              arrival: {
                airport: "SFO",
                city: "San Francisco",
                dateTime: "2099-07-12T10:30:00",
              },
              duration: 570,
              stops: 0,
              price: 980,
              currency: "USD",
              affiliatePartner: "duffel",
              affiliateUrl:
                "https://book.duffel.com/flights/HND-SFO?reference=return1",
              quotedAt: "2099-07-01T00:00:00.000Z",
              expiresAt: "2099-07-10T00:00:00.000Z",
            },
          },
        ],
        overview: "Tokyo itinerary with verified flights, hotel, and tours.",
        total_cost: { amount: 2450, currency: "USD" },
        packing_list: ["Passport", "Comfortable walking shoes"],
        general_tips: ["Arrive at Haneda 2.5 hours prior to departure."],
        generated_at: "2026-10-03T00:00:00.000Z",
      },
    ],
  };

  const ownedSearch = {
    id: DEFAULT_E2E_SEARCH_ID,
    user_id: DEFAULT_E2E_AUTH_USER_ID,
    status: "completed",
    intermediate_results: {
      topHotel: {
        id: "top_hotel_tokyo",
        name: "Aman Tokyo",
        starRating: 5,
        userRating: 4.9,
        reviewCount: 420,
        description: "Sanctuary above Otemachi with panoramic city views.",
        amenities: ["Spa", "Pool", "City View"],
        pricePerNight: 850,
        currency: "USD",
        affiliatePartner: "stay22",
        affiliateUrl:
          "https://www.stay22.com/allez/roam?aid=faroway&address=Aman+Tokyo",
      },
    },
  };

  return { sharedTrip, ownedTrip, ownedSearch };
}

let trips = new Map();
let searches = new Map();
let sharedTripReactions = new Map();
let tripBookingReports = [];
let blogPosts = createSeededBlogPosts();
let affiliateClicks = new Map();
let affiliateConversions = new Map();
let rateLimitConfig = { allowed: true, remaining: 29, reset_in_ms: 60000 };
let rateLimitCalls = [];
let viatorConfig = { status: 200, products: {} };
let viatorCalls = [];
let prepareHandoffOverride = null;

function seedIntegratedState() {
  const { sharedTrip, ownedTrip, ownedSearch } = createIntegratedSeedData();
  trips.set(sharedTrip.id, sharedTrip);
  trips.set(ownedTrip.id, ownedTrip);
  searches.set(ownedSearch.id, ownedSearch);
}

if (process.env.E2E_SEED_INTEGRATED === "true") {
  seedIntegratedState();
}

function decodeJwtSub(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7).trim();
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return typeof payload?.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

function projectSelect(row, selectParam) {
  if (!selectParam || selectParam === "*" || selectParam.includes("(")) {
    return row;
  }
  const cols = selectParam
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (cols.length === 0) return row;
  const projected = {};
  for (const col of cols) {
    if (col in row) projected[col] = row[col];
  }
  return projected;
}

function matchesSearchParams(row, searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (
      key === "select" ||
      key === "order" ||
      key === "limit" ||
      key === "offset" ||
      key === "on_conflict"
    ) {
      continue;
    }
    if (value.startsWith("eq.")) {
      if (String(row[key]) !== value.slice(3)) return false;
    } else if (value.startsWith("like.")) {
      const pattern = value.slice(5);
      if (pattern.endsWith("%")) {
        if (!String(row[key] ?? "").startsWith(pattern.slice(0, -1))) {
          return false;
        }
      } else if (String(row[key] ?? "") !== pattern) {
        return false;
      }
    }
  }
  return true;
}

function sortRows(rows, orderParam) {
  if (!orderParam) return rows;
  const clauses = orderParam
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [col, dir] = part.split(".");
      return { col, desc: dir === "desc" };
    });
  if (clauses.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { col, desc } of clauses) {
      const av = String(a?.[col] ?? "");
      const bv = String(b?.[col] ?? "");
      const cmp = av.localeCompare(bv);
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function paginateRows(rows, searchParams) {
  const offsetParam = Number(searchParams.get("offset"));
  const limitParam = Number(searchParams.get("limit"));
  const start = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;
  const end =
    Number.isFinite(limitParam) && limitParam > 0
      ? start + limitParam
      : rows.length;
  return rows.slice(start, end);
}

const server = createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : null;
  const url = new URL(req.url || "/", "http://127.0.0.1:4411");

  if (url.pathname.startsWith("/storage/v1/object/public/")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(ONE_BY_ONE_PNG);
    return;
  }

  res.setHeader("Content-Type", "application/json");

  const send = (value, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };

  // Fixture control endpoints
  if (url.pathname === "/fixture/reset") {
    trips = new Map();
    searches = new Map();
    sharedTripReactions = new Map();
    tripBookingReports = [];
    blogPosts = createSeededBlogPosts();
    affiliateClicks = new Map();
    affiliateConversions = new Map();
    rateLimitConfig = { allowed: true, remaining: 29, reset_in_ms: 60000 };
    rateLimitCalls = [];
    viatorConfig = { status: 200, products: {} };
    viatorCalls = [];
    prepareHandoffOverride = null;
    if (process.env.E2E_SEED_INTEGRATED === "true") {
      seedIntegratedState();
    }
    return send({});
  }

  if (url.pathname === "/fixture/seed-integrated") {
    seedIntegratedState();
    return send({ ok: true });
  }

  if (url.pathname === "/fixture/state") {
    return send({
      trips: [...trips.values()],
      searches: [...searches.values()],
      sharedTripReactions: [...sharedTripReactions.values()],
      blogPosts,
      affiliateClicks: [...affiliateClicks.values()],
      affiliateConversions: [...affiliateConversions.values()],
      rateLimitCalls,
      viatorCalls,
    });
  }

  if (url.pathname === "/fixture/trip") {
    trips.set(body.id, body);
    return send({ ok: true });
  }

  if (url.pathname === "/fixture/rate-limit") {
    rateLimitConfig = { ...rateLimitConfig, ...body };
    return send(rateLimitConfig);
  }

  if (url.pathname === "/fixture/viator") {
    if (body?.reset) {
      viatorConfig = { status: 200, products: {} };
    } else if (body?.productCode) {
      viatorConfig.products[body.productCode] = body;
    } else {
      viatorConfig = { ...viatorConfig, ...body };
    }
    return send(viatorConfig);
  }

  if (url.pathname === "/fixture/handoff-override") {
    prepareHandoffOverride = body?.value ?? null;
    return send({ prepareHandoffOverride });
  }

  // Mock Viator Partner API
  if (url.pathname.startsWith("/viator-partner/products/")) {
    const code = decodeURIComponent(
      url.pathname.slice("/viator-partner/products/".length),
    );
    viatorCalls.push({
      code,
      search: url.search,
      apiKey: req.headers["exp-api-key"] ?? null,
    });
    const entry = viatorConfig.products[code];
    const status = entry?.status ?? viatorConfig.status ?? 200;
    if (status !== 200) {
      return send({ error: "Product lookup failed" }, status);
    }
    const product = entry?.product ?? {
      productCode: code,
      title: `Mock Viator Tour ${code}`,
      productUrl: `https://www.viator.com/tours/Paris/Walk/d479-${code}?pid=P12345678&mcid=42383&medium=api`,
    };
    return send(product);
  }

  // Supabase Auth
  if (url.pathname === "/auth/v1/user") {
    const sub = decodeJwtSub(req.headers.authorization);
    if (!sub) {
      return send({ message: "Invalid or missing token" }, 401);
    }
    return send({
      id: sub,
      aud: "authenticated",
      role: "authenticated",
      email: "fixture@example.invalid",
      app_metadata: {},
      user_metadata: {},
    });
  }

  // Supabase RPCs
  if (url.pathname === "/rest/v1/rpc/consume_rate_limit") {
    rateLimitCalls.push(body);
    return send([rateLimitConfig]);
  }

  if (url.pathname === "/rest/v1/rpc/get_shared_trip_reaction_counts") {
    const shareToken = body?.p_share_token;
    const grouped = new Map();
    for (const row of sharedTripReactions.values()) {
      if (row.share_token !== shareToken) continue;
      const key = `${row.stop_key}::${row.reaction}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, {
          stop_key: row.stop_key,
          reaction: row.reaction,
          count: 1,
        });
      }
    }
    return send([...grouped.values()]);
  }

  if (url.pathname === "/rest/v1/rpc/read_trip_booking_reports") {
    const trip = trips.get(body?.p_trip_id);
    if (!trip || trip.user_id !== body?.p_user_id) {
      return send(null);
    }
    const reports = tripBookingReports.filter(
      (r) => r.trip_id === body.p_trip_id && r.user_id === body.p_user_id,
    );
    const receipt = Boolean(
      body?.p_request_id &&
        reports.some((r) => r.request_id === body.p_request_id),
    );
    return send({ reports, receipt });
  }

  if (url.pathname === "/rest/v1/rpc/increment_blog_view_count") {
    const slug = body?.p_slug;
    const post = blogPosts.find((p) => p.slug === slug);
    if (post) {
      post.view_count = (post.view_count || 0) + 1;
    }
    return send(null);
  }

  if (url.pathname === "/rest/v1/rpc/prepare_trip_handoff") {
    if (prepareHandoffOverride !== null) {
      const result = prepareHandoffOverride;
      prepareHandoffOverride = null;
      return send(result);
    }
    const trip = trips.get(body.p_trip_id);
    if (
      !trip ||
      trip.user_id !== body.p_user_id ||
      trip.updated_at !== body.p_revision ||
      !["planned", "generated", "booked", "completed"].includes(trip.status) ||
      trip.preferences?.planNeedsRefresh === true
    ) {
      return send(false);
    }
    if (!affiliateClicks.has(body.p_click_id)) {
      affiliateClicks.set(body.p_click_id, {
        id: body.p_click_id,
        user_id: body.p_user_id,
        trip_id: body.p_trip_id,
        item_id: body.p_item_id,
        item_type: "activity",
        item_name: body.p_item_name,
        affiliate_partner: "viator",
        affiliate_url: body.p_url,
        source: "itinerary",
        converted: false,
        conversion_value: null,
        clicked_at: new Date().toISOString(),
        trip_revision: body.p_revision,
      });
    }
    const row = affiliateClicks.get(body.p_click_id);
    return send(
      row.user_id === body.p_user_id &&
        row.trip_id === body.p_trip_id &&
        row.item_id === body.p_item_id &&
        row.item_type === "activity" &&
        row.affiliate_partner === "viator" &&
        row.trip_revision === body.p_revision,
    );
  }

  // Supabase tables
  if (url.pathname === "/rest/v1/trips") {
    const filtered = [...trips.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    const sorted = sortRows(filtered, url.searchParams.get("order"));
    const limited = paginateRows(sorted, url.searchParams);
    const selectParam = url.searchParams.get("select");
    const projected = limited.map((row) => projectSelect(row, selectParam));
    if (req.headers.accept?.includes("vnd.pgrst.object")) {
      return projected[0]
        ? send(projected[0])
        : send({ code: "PGRST116" }, 406);
    }
    return send(projected);
  }

  if (url.pathname === "/rest/v1/searches") {
    const filtered = [...searches.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    const limited = paginateRows(filtered, url.searchParams);
    const selectParam = url.searchParams.get("select");
    const projected = limited.map((row) => projectSelect(row, selectParam));
    if (req.headers.accept?.includes("vnd.pgrst.object")) {
      return projected[0]
        ? send(projected[0])
        : send({ code: "PGRST116" }, 406);
    }
    return send(projected);
  }

  if (url.pathname === "/rest/v1/shared_trip_reactions") {
    if (req.method === "POST") {
      const items = Array.isArray(body) ? body : [body];
      const saved = items.map((item) => {
        const key = `${item.share_token}::${item.stop_key}::${item.reaction}::${item.voter_id}`;
        const row = { id: randomUUID(), ...item };
        sharedTripReactions.set(key, row);
        return row;
      });
      return send(Array.isArray(body) ? saved : saved[0], 201);
    }
    if (req.method === "DELETE") {
      for (const [key, row] of sharedTripReactions.entries()) {
        if (matchesSearchParams(row, url.searchParams)) {
          sharedTripReactions.delete(key);
        }
      }
      return send([]);
    }
    const matches = [...sharedTripReactions.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    return send(matches);
  }

  if (url.pathname === "/rest/v1/blog_posts") {
    const filtered = blogPosts.filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    const sorted = sortRows(filtered, url.searchParams.get("order"));
    const limited = paginateRows(sorted, url.searchParams);
    const selectParam = url.searchParams.get("select");
    const projected = limited.map((row) => projectSelect(row, selectParam));
    res.setHeader(
      "Content-Range",
      projected.length > 0
        ? `0-${projected.length - 1}/${filtered.length}`
        : `*/${filtered.length}`,
    );
    if (req.headers.accept?.includes("vnd.pgrst.object")) {
      return projected[0]
        ? send(projected[0])
        : send({ code: "PGRST116" }, 406);
    }
    return send(projected);
  }

  if (url.pathname === "/rest/v1/blog_post_views") {
    if (req.method === "POST") {
      return send(body ?? {}, 201);
    }
    return send([]);
  }

  if (url.pathname === "/rest/v1/affiliate_clicks") {
    if (req.method === "POST") {
      const items = Array.isArray(body) ? body : [body];
      const inserted = items.map((item) => {
        const row = {
          converted: false,
          conversion_value: null,
          trip_revision: null,
          ...item,
        };
        affiliateClicks.set(row.id, row);
        return row;
      });
      return send(Array.isArray(body) ? inserted : inserted[0], 201);
    }
    const matches = [...affiliateClicks.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    if (req.method === "PATCH") {
      for (const row of matches) Object.assign(row, body);
      res.setHeader(
        "Content-Range",
        `0-${Math.max(0, matches.length - 1)}/${matches.length}`,
      );
      return send(matches);
    }
    const orderParam = url.searchParams.get("order");
    if (orderParam === "clicked_at.desc") {
      matches.sort((a, b) =>
        String(b.clicked_at).localeCompare(String(a.clicked_at)),
      );
    }
    const limitParam = Number(url.searchParams.get("limit"));
    const limited =
      Number.isFinite(limitParam) && limitParam > 0
        ? matches.slice(0, limitParam)
        : matches;
    const selectParam = url.searchParams.get("select");
    const projected = limited.map((row) => projectSelect(row, selectParam));

    if (req.headers.accept?.includes("vnd.pgrst.object")) {
      return projected[0]
        ? send(projected[0])
        : send({ code: "PGRST116" }, 406);
    }
    return send(projected);
  }

  if (url.pathname === "/rest/v1/affiliate_conversions") {
    if (req.method === "POST") {
      const items = Array.isArray(body) ? body : [body];
      const prefer = String(req.headers.prefer || "");
      const isUpsert =
        prefer.includes("resolution=merge-duplicates") ||
        url.searchParams.has("on_conflict");
      const saved = items.map((item) => {
        const conversionKey =
          (typeof item.order_id === "string" && item.order_id) ||
          (typeof item.booking_reference === "string" &&
            item.booking_reference) ||
          (typeof item.click_id === "string" && item.click_id) ||
          randomUUID();
        const compositeKey = `${item.partner}::${conversionKey}`;
        const existing = affiliateConversions.get(compositeKey);
        if (existing && isUpsert) {
          Object.assign(existing, item, { conversion_key: conversionKey });
          return existing;
        }
        const row = {
          id: existing?.id ?? randomUUID(),
          ...item,
          conversion_key: conversionKey,
        };
        affiliateConversions.set(compositeKey, row);
        return row;
      });
      return send(Array.isArray(body) ? saved : saved[0], 201);
    }
    const matches = [...affiliateConversions.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    return send(matches);
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    return send([]);
  }

  return send({ error: "Unhandled fixture request" }, 404);
});

server.on("error", (err) => {
  console.error("[monetization-server] Loopback server error:", err);
  cleanup();
  process.exit(1);
});

server.listen(4411, "127.0.0.1");

// Copy into isolated tmpdir to compile & serve real Next.js app without modifying repo
const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "faroway-monetization-app-"),
);
const repoRoot = path.resolve("../..");
let child = null;
let building = true;
let stopping = false;
let shuttingDown = false;
let forceStop;

const killChildGroup = (signal) => {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    /* Already stopped. */
  }
};

const cleanup = () => {
  try {
    server.closeAllConnections();
    server.close();
  } catch (err) {
    console.error("[monetization-server] Failed closing loopback server:", err);
  }
  if (!existsSync(fixtureRoot)) return;
  try {
    rmSync(fixtureRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 150,
    });
  } catch (err) {
    console.error(
      "[monetization-server] rmSync cleanup failed, falling back to rm -rf:",
      err,
    );
    try {
      execFileSync("rm", ["-rf", fixtureRoot]);
    } catch (fallbackErr) {
      console.error(
        `[monetization-server] Fallback rm -rf failed for ${fixtureRoot}:`,
        fallbackErr,
      );
    }
  }
  if (existsSync(fixtureRoot)) {
    console.error(
      `[monetization-server] fixtureRoot still exists after cleanup: ${fixtureRoot}`,
    );
  }
};

const waitForGroupGone = async (pid, timeoutMs) => {
  if (!pid) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const shutdown = async (exitCode) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (forceStop) clearTimeout(forceStop);
  const pid = child?.pid;
  if (pid) {
    killChildGroup("SIGTERM");
    await waitForGroupGone(pid, 1_500);
    killChildGroup("SIGKILL");
    await waitForGroupGone(pid, 1_000);
    // Brief settle wait so OS releases any remaining .next file descriptors
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  cleanup();
  process.exit(exitCode);
};

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void shutdown(0);
  });
}

process.on("uncaughtException", (err) => {
  console.error("[monetization-server] uncaughtException:", err);
  stopping = true;
  void shutdown(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[monetization-server] unhandledRejection:", reason);
  stopping = true;
  void shutdown(1);
});

process.on("exit", () => {
  killChildGroup("SIGKILL");
  cleanup();
});

const copyFilter = (source) =>
  ![
    "node_modules",
    ".next",
    ".turbo",
    ".git",
    "test-results",
    "playwright-report",
  ].includes(path.basename(source)) &&
  !path.basename(source).startsWith(".env");

try {
  cpSync(path.join(repoRoot, "apps/web"), path.join(fixtureRoot, "apps/web"), {
    recursive: true,
    filter: copyFilter,
  });
  cpSync(path.join(repoRoot, "packages"), path.join(fixtureRoot, "packages"), {
    recursive: true,
    filter: copyFilter,
  });
  for (const directory of [
    "scripts/fixtures",
    "scripts/uat/lib",
    "apps/mobile/lib",
  ]) {
    cpSync(path.join(repoRoot, directory), path.join(fixtureRoot, directory), {
      recursive: true,
      filter: copyFilter,
    });
  }
  cpSync(
    path.join(repoRoot, "package.json"),
    path.join(fixtureRoot, "package.json"),
  );

  const dependencies = realpathSync(path.join(repoRoot, "node_modules"));
  const fixtureModules = path.join(fixtureRoot, "node_modules");
  mkdirSync(fixtureModules);
  for (const entry of readdirSync(dependencies)) {
    if (entry !== "@faroway") {
      symlinkSync(
        path.join(dependencies, entry),
        path.join(fixtureModules, entry),
      );
    }
  }
  mkdirSync(path.join(fixtureModules, "@faroway"));
  for (const entry of readdirSync(path.join(dependencies, "@faroway"))) {
    const installed = realpathSync(path.join(dependencies, "@faroway", entry));
    const isApp = entry === "web" || entry === "mobile";
    const snapshot = isApp
      ? path.join(fixtureRoot, "apps", entry)
      : path.join(fixtureRoot, "packages", entry);
    symlinkSync(
      existsSync(snapshot) ? snapshot : installed,
      path.join(fixtureModules, "@faroway", entry),
    );
    if (
      existsSync(snapshot) &&
      existsSync(path.join(installed, "node_modules"))
    ) {
      symlinkSync(
        path.join(installed, "node_modules"),
        path.join(snapshot, "node_modules"),
      );
    }
  }

  const fixtureConfig = path.join(fixtureRoot, "apps/web/next.config.ts");
  const rawConfig = readFileSync(fixtureConfig, "utf8");
  const withCpus = rawConfig.replace(
    "const nextConfig: NextConfig = {",
    "const nextConfig: NextConfig = { experimental: { cpus: 2 },",
  );
  const patchedConfig = withCpus.replace(
    "export default ",
    `const __origWebpack = nextConfig.webpack;
nextConfig.webpack = (config, ...args) => {
  const resolved = typeof __origWebpack === "function" ? __origWebpack(config, ...args) : config;
  if (resolved && typeof resolved === "object") {
    resolved.cache = false;
  }
  return resolved;
};

export default `,
  );
  if (
    patchedConfig === rawConfig ||
    !patchedConfig.includes("resolved.cache = false")
  ) {
    throw new Error("Failed to patch fixture next.config.ts");
  }
  writeFileSync(fixtureConfig, patchedConfig);
} catch (setupErr) {
  console.error("[monetization-server] Fixture setup failed:", setupErr);
  cleanup();
  process.exit(1);
}

const preloadPath = path.join(
  fixtureRoot,
  "apps/web/e2e/fixtures/monetization-fetch.mjs",
);

const fixtureEnv = {
  PATH: process.env.PATH,
  HOME: path.join(fixtureRoot, "home"),
  NODE_ENV: "production",
  IP_HASH_SALT: "isolated-fixture-rate-limit-salt",
  SHARED_REACTIONS_SECRET: "fixture-shared-reactions-secret",
  FAROWAY_BOOKING_CHECKLIST_ENABLED: "true",
  FAROWAY_PLAN_EDITING_ENABLED: "true",
  NODE_OPTIONS: `--max-old-space-size=3072 --import=${preloadPath}`,
  WORKFLOW_TARGET_WORLD: "local",
  WORKFLOW_LOCAL_DATA_DIR: path.join(fixtureRoot, "workflow-data"),
  WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:4410",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.join(
    fixtureRoot,
    "apps/web/e2e/fixtures/fonts.cjs",
  ),
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4411",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:4410",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:4410",
  VIATOR_API_KEY: "fixture-viator-key",
  VIATOR_PARTNER_ID: "P12345678",
  VIATOR_MCID: "42383",
  VIATOR_CONTENT_ENABLED: "true",
  VIATOR_CONTENT_APPROVAL_REF: "fixture-approval-ref",
  VIATOR_HOSTED_CHECKOUT_ENABLED: "true",
  VIATOR_SANDBOX: "false",
  VIATOR_WEBHOOK_SECRET: "fixture-viator-webhook-secret",
  GYG_WEBHOOK_SECRET: "fixture-gyg-webhook-secret",
  KLOOK_WEBHOOK_SECRET: "fixture-klook-webhook-secret",
  TRAVELPAYOUTS_WEBHOOK_SECRET: "fixture-travelpayouts-webhook-secret",
  STAY22_WEBHOOK_SECRET: "fixture-stay22-webhook-secret",
  DUFFEL_WEBHOOK_SECRET: "fixture-duffel-webhook-secret",
  SAFETYWING_WEBHOOK_SECRET: "fixture-safetywing-webhook-secret",
  AIRALO_WEBHOOK_SECRET: "fixture-airalo-webhook-secret",
  STAY22_AID: "faroway-fixture",
  BOOKING_AFFILIATE_ID: "123456",
  EXPEDIA_AFFCID: "fixture-expedia-affcid",
  HOSTELWORLD_AFFILIATE_ID: "fixture-hostelworld",
  GETYOURGUIDE_PARTNER_ID: "FAROWAY",
  TRAVELPAYOUTS_MARKER: "12345",
  TRAVELPAYOUTS_TRS: "99",
  KLOOK_AFFILIATE_ID: "111",
  SKYSCANNER_ASSOCIATE_ID: "fixture-skyscanner",
  SAFETYWING_REFERENCE_ID: "fixture-safetywing",
  AIRALO_AFFILIATE_ID: "fixture-airalo",
  DISCOVERCARS_AFFILIATE_ID: "fixture-discovercars",
  IVISA_AFFILIATE_ID: "fixture-ivisa",
  WISE_AFFILIATE_ID: "fixture-wise",
};

const launch = (args) =>
  spawn(
    process.execPath,
    [path.join(repoRoot, "node_modules/next/dist/bin/next"), ...args],
    {
      stdio: "inherit",
      detached: true,
      cwd: path.join(fixtureRoot, "apps/web"),
      env: fixtureEnv,
    },
  );

child = launch(["build", "--webpack"]);

const onExit = (code, signal) => {
  if (building && !stopping && code === 0 && !signal) {
    building = false;
    child = launch(["start", "--hostname", "127.0.0.1", "--port", "4410"]);
    child.on("exit", onExit);
    return;
  }
  void shutdown(stopping ? 0 : code || 1);
};

child.on("exit", onExit);
