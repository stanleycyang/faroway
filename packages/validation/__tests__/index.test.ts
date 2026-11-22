import { describe, it, expect } from "vitest";
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  dateSchema,
  registerSchema,
  loginSchema,
  tripStatusSchema,
  budgetLevelSchema,
  budgetTierInputSchema,
  travelVibeIdSchema,
  normalizedTravelVibeSchema,
  travelerTypeSchema,
  createTripSchema,
  updateTripSchema,
  activitySchema,
  createItinerarySchema,
  updateItinerarySchema,
  travelStyleSchema,
  updatePreferencesSchema,
  paginationSchema,
  tripQuerySchema,
  searchInputSchema,
  affiliatePartnerIdSchema,
  affiliateClickItemTypeSchema,
  affiliateClickSourceSchema,
  trackClickSchema,
  conversionWebhookSchema,
} from "../src/index";

describe("uuidSchema", () => {
  it("accepts valid UUID", () => {
    const result = uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = uuidSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("accepts valid email and lowercases it", () => {
    const result = emailSchema.safeParse("User@Example.COM");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("user@example.com");
    }
  });

  it("rejects invalid email", () => {
    expect(emailSchema.safeParse("not-email").success).toBe(false);
  });

  it("rejects email with spaces", () => {
    expect(emailSchema.safeParse("  user@example.com  ").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts valid password", () => {
    expect(passwordSchema.safeParse("MyPassword1").success).toBe(true);
  });

  it("rejects short password", () => {
    expect(passwordSchema.safeParse("Ab1").success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    expect(passwordSchema.safeParse("alllower1").success).toBe(false);
  });

  it("rejects password without number", () => {
    expect(passwordSchema.safeParse("AllLettersNoNum").success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    expect(passwordSchema.safeParse("ALLUPPER1").success).toBe(false);
  });

  it("rejects password over 100 characters", () => {
    expect(passwordSchema.safeParse("Aa1" + "a".repeat(98)).success).toBe(
      false,
    );
  });
});

describe("dateSchema", () => {
  it("accepts valid date string", () => {
    expect(dateSchema.safeParse("2026-06-01").success).toBe(true);
  });

  it("rejects invalid date string", () => {
    expect(dateSchema.safeParse("not-a-date").success).toBe(false);
  });
});

describe("tripStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const statuses = [
      "draft",
      "planning",
      "planned",
      "generating",
      "failed",
      "booked",
      "active",
      "in_progress",
      "paid",
      "completed",
      "canceled",
    ];
    for (const status of statuses) {
      expect(tripStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(tripStatusSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("budgetLevelSchema", () => {
  it("accepts all valid levels", () => {
    expect(budgetLevelSchema.safeParse("budget").success).toBe(true);
    expect(budgetLevelSchema.safeParse("moderate").success).toBe(true);
    expect(budgetLevelSchema.safeParse("luxury").success).toBe(true);
  });

  it("rejects invalid level", () => {
    expect(budgetLevelSchema.safeParse("extreme").success).toBe(false);
  });
});

describe("travelerTypeSchema", () => {
  it("accepts all valid types", () => {
    const types = ["solo", "couple", "family", "friends", "business"];
    for (const type of types) {
      expect(travelerTypeSchema.safeParse(type).success).toBe(true);
    }
  });
});

describe("createTripSchema", () => {
  const valid = {
    destination: "Tokyo",
    start_date: "2026-04-01",
    end_date: "2026-04-07",
  };

  it("accepts valid input with defaults", () => {
    const result = createTripSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
    }
  });

  it("rejects empty destination", () => {
    expect(
      createTripSchema.safeParse({ ...valid, destination: "" }).success,
    ).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    expect(
      createTripSchema.safeParse({
        ...valid,
        start_date: "2026-04-07",
        end_date: "2026-04-01",
      }).success,
    ).toBe(false);
  });

  it("accepts same start and end date", () => {
    expect(
      createTripSchema.safeParse({
        ...valid,
        start_date: "2026-04-01",
        end_date: "2026-04-01",
      }).success,
    ).toBe(true);
  });

  it("accepts negative budget", () => {
    expect(createTripSchema.safeParse({ ...valid, budget: -100 }).success).toBe(
      false,
    );
  });
});

describe("updateTripSchema", () => {
  it("accepts empty object", () => {
    expect(updateTripSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update", () => {
    const result = updateTripSchema.safeParse({ destination: "Osaka" });
    expect(result.success).toBe(true);
  });

  it("passes when only one date provided", () => {
    expect(
      updateTripSchema.safeParse({ start_date: "2026-06-01" }).success,
    ).toBe(true);
  });
});

describe("activitySchema", () => {
  it("accepts valid activity", () => {
    expect(
      activitySchema.safeParse({
        time: "09:30",
        title: "Visit Museum",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid time format", () => {
    expect(
      activitySchema.safeParse({ time: "9:30am", title: "Visit" }).success,
    ).toBe(false);
  });
});

describe("createItinerarySchema", () => {
  it("accepts valid itinerary", () => {
    const result = createItinerarySchema.safeParse({
      trip_id: "550e8400-e29b-41d4-a716-446655440000",
      day_number: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activities).toEqual([]);
    }
  });

  it("rejects non-positive day number", () => {
    expect(
      createItinerarySchema.safeParse({
        trip_id: "550e8400-e29b-41d4-a716-446655440000",
        day_number: 0,
      }).success,
    ).toBe(false);
  });
});

describe("updateItinerarySchema", () => {
  it("accepts valid update", () => {
    expect(
      updateItinerarySchema.safeParse({ notes: "Updated notes" }).success,
    ).toBe(true);
  });

  it("accepts null notes", () => {
    expect(updateItinerarySchema.safeParse({ notes: null }).success).toBe(true);
  });
});

describe("travelStyleSchema", () => {
  it("accepts all valid styles", () => {
    const styles = ["budget", "mid_range", "luxury", "backpacker", "business"];
    for (const style of styles) {
      expect(travelStyleSchema.safeParse(style).success).toBe(true);
    }
  });
});

describe("updatePreferencesSchema", () => {
  it("accepts valid preferences", () => {
    const result = updatePreferencesSchema.safeParse({
      interests: ["hiking", "food"],
      travel_style: "luxury",
      dietary_restrictions: ["vegetarian"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null travel_style", () => {
    expect(
      updatePreferencesSchema.safeParse({ travel_style: null }).success,
    ).toBe(true);
  });

  it("rejects too many interests (> 50)", () => {
    const interests = Array.from({ length: 51 }, (_, i) => `interest-${i}`);
    expect(updatePreferencesSchema.safeParse({ interests }).success).toBe(
      false,
    );
  });
});

describe("paginationSchema", () => {
  it("defaults to page 1 and limit 10", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
    }
  });

  it("coerces strings", () => {
    const result = paginationSchema.safeParse({ page: "3", limit: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(25);
    }
  });
});

describe("tripQuerySchema", () => {
  it("extends pagination with optional status and destination", () => {
    const result = tripQuerySchema.safeParse({
      status: "draft",
      destination: "Tokyo",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.destination).toBe("Tokyo");
      expect(result.data.page).toBe(1);
    }
  });
});

describe("searchInputSchema", () => {
  const valid = {
    destination: "Barcelona",
    startDate: "2026-07-01",
    endDate: "2026-07-14",
    travelers: 2,
  };

  it("accepts valid input with defaults", () => {
    const result = searchInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vibes).toEqual([]);
    }
  });

  it("rejects too many travelers", () => {
    expect(
      searchInputSchema.safeParse({ ...valid, travelers: 21 }).success,
    ).toBe(false);
  });
});

describe("trackClickSchema", () => {
  const valid = {
    itemType: "hotel" as const,
    itemId: "htl-1",
    itemName: "Grand Hotel",
    affiliatePartner: "retired-supplier.example",
    affiliateUrl: "https://retired-supplier.example/htl-1",
  };

  it("accepts valid click", () => {
    expect(trackClickSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid URL", () => {
    expect(
      trackClickSchema.safeParse({ ...valid, affiliateUrl: "not-url" }).success,
    ).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = trackClickSchema.safeParse({
      ...valid,
      searchId: "s-1",
      tripId: "t-1",
      price: 100,
      currency: "USD",
      source: "search_results",
    });
    expect(result.success).toBe(true);
  });

  it("accepts transport itemType and expanded monetization sources", () => {
    const result = trackClickSchema.safeParse({
      ...valid,
      itemType: "transport",
      source: "shared_trip",
      clickId: "clk-123",
      placement: "sticky_drawer",
      campaign: "paris_q2",
    });
    expect(result.success).toBe(true);
  });
});

describe("travelVibeIdSchema & normalizedTravelVibeSchema", () => {
  it("validates canonical vibe IDs and maps cultural alias to culture", () => {
    expect(travelVibeIdSchema.safeParse("culture").success).toBe(true);
    expect(travelVibeIdSchema.safeParse("shopping").success).toBe(true);
    expect(travelVibeIdSchema.safeParse("photography").success).toBe(true);
    expect(travelVibeIdSchema.safeParse("cultural").success).toBe(false);

    const aliased = normalizedTravelVibeSchema.safeParse("cultural");
    expect(aliased.success).toBe(true);
    if (aliased.success) expect(aliased.data).toBe("culture");

    const trimmed = normalizedTravelVibeSchema.safeParse("  Culture ");
    expect(trimmed.success).toBe(true);
    if (trimmed.success) expect(trimmed.data).toBe("culture");

    expect(normalizedTravelVibeSchema.safeParse("invalid").success).toBe(false);
  });
});

describe("budgetTierInputSchema", () => {
  it("normalizes Comfort and mid_range to moderate while preserving strict budgetLevelSchema", () => {
    for (const [raw, expected] of [
      ["Budget", "budget"],
      ["Comfort", "moderate"],
      ["Moderate", "moderate"],
      ["mid_range", "moderate"],
      ["mid-range", "moderate"],
      ["Luxury", "luxury"],
    ] as const) {
      const parsed = budgetTierInputSchema.safeParse(raw);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data).toBe(expected);
    }

    expect(budgetTierInputSchema.safeParse("extreme").success).toBe(false);
    expect(budgetLevelSchema.safeParse("comfort").success).toBe(false);
  });
});

describe("affiliatePartnerIdSchema & conversionWebhookSchema", () => {
  it("accepts all 17 canonical affiliate partners and valid webhook payloads", () => {
    const partners = [
      "viator",
      "getyourguide",
      "travelpayouts",
      "stay22",
      "booking",
      "expedia",
      "safetywing",
      "airalo",
      "klook",
      "discovercars",
      "hostelworld",
      "duffel",
      "tripadvisor",
      "opentable",
      "skyscanner",
      "ivisa",
      "wise",
    ];
    for (const partner of partners) {
      expect(affiliatePartnerIdSchema.safeParse(partner).success).toBe(true);
    }
    expect(affiliatePartnerIdSchema.safeParse("unknown").success).toBe(false);

    expect(affiliateClickItemTypeSchema.safeParse("transport").success).toBe(
      true,
    );
    expect(affiliateClickSourceSchema.safeParse("on_trip").success).toBe(true);

    const webhook = conversionWebhookSchema.safeParse({
      partner: "stay22",
      clickId: "clk-777",
      externalTransactionId: "tx-999",
      bookingAmount: 420.5,
      commissionAmount: 25.2,
      currency: "USD",
      occurredAt: "2026-11-21T07:00:00Z",
    });
    expect(webhook.success).toBe(true);
    if (webhook.success) {
      expect(webhook.data.status).toBe("confirmed");
      expect(webhook.data.currency).toBe("USD");
      expect(webhook.data.occurredAt).toBe("2026-11-21T07:00:00Z");
    }

    expect(
      conversionWebhookSchema.safeParse({
        partner: "stay22",
        clickId: "clk-777",
        externalTransactionId: "tx-1000",
        occurredAt: "2026-11-21",
      }).success,
    ).toBe(true);
  });

  it("rejects non-finite amounts, invalid currencies, and non-ISO occurredAt values", () => {
    const base = {
      partner: "viator",
      clickId: "clk-1",
      externalTransactionId: "tx-1",
    } as const;

    expect(
      conversionWebhookSchema.safeParse({ ...base, bookingAmount: Infinity }).success,
    ).toBe(false);
    expect(
      conversionWebhookSchema.safeParse({ ...base, bookingAmount: Number.NaN }).success,
    ).toBe(false);
    expect(
      conversionWebhookSchema.safeParse({ ...base, commissionAmount: Infinity }).success,
    ).toBe(false);
    expect(
      conversionWebhookSchema.safeParse({ ...base, commissionAmount: -1 }).success,
    ).toBe(false);

    for (const badCurrency of ["12$", "usd", "US", "USDX", " USD "]) {
      expect(
        conversionWebhookSchema.safeParse({ ...base, currency: badCurrency }).success,
      ).toBe(false);
    }

    for (const badDate of ["0", "not-a-date", "2026-02-30", "2026-13-01", "2026/11/21"]) {
      expect(
        conversionWebhookSchema.safeParse({ ...base, occurredAt: badDate }).success,
      ).toBe(false);
    }
  });

  it("restricts conversionWebhookSchema.partner to the 8 webhook-supported partners", () => {
    const supported = [
      "viator",
      "getyourguide",
      "klook",
      "travelpayouts",
      "stay22",
      "duffel",
      "safetywing",
      "airalo",
    ];
    for (const partner of supported) {
      expect(
        conversionWebhookSchema.safeParse({
          partner,
          clickId: "clk-1",
          externalTransactionId: "tx-1",
        }).success,
      ).toBe(true);
    }

    const nonWebhook = [
      "booking",
      "expedia",
      "discovercars",
      "hostelworld",
      "tripadvisor",
      "opentable",
      "skyscanner",
      "ivisa",
      "wise",
    ];
    for (const partner of nonWebhook) {
      expect(
        conversionWebhookSchema.safeParse({
          partner,
          clickId: "clk-1",
          externalTransactionId: "tx-1",
        }).success,
      ).toBe(false);
    }
  });
});
