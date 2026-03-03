import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  createTripSchema,
  updateTripSchema,
  activitySchema,
  searchInputSchema,
  trackClickSchema,
  paginationSchema,
} from "@faroway/validation";

// =============================================================================
// registerSchema
// =============================================================================

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      email: "User@Example.com",
      name: "Jane Doe",
      password: "Secret1pass",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.name).toBe("Jane Doe");
    }
  });

  it("rejects missing email", () => {
    const result = registerSchema.safeParse({
      name: "Jane Doe",
      password: "Secret1pass",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("email");
    }
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      name: "Jane Doe",
      password: "Secret1pass",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("email");
    }
  });

  it("rejects short password (fewer than 8 characters)", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      name: "Jane Doe",
      password: "Ab1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("password");
    }
  });

  it("rejects password without uppercase letter", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      name: "Jane Doe",
      password: "alllowercase1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("password");
    }
  });

  it("rejects password without a number", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      name: "Jane Doe",
      password: "NoNumbersHere",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("password");
    }
  });

  it("rejects name longer than 255 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      name: "A".repeat(256),
      password: "Secret1pass",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("name");
    }
  });
});

// =============================================================================
// loginSchema
// =============================================================================

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({
      email: "User@Example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("password");
    }
  });
});

// =============================================================================
// createTripSchema
// =============================================================================

describe("createTripSchema", () => {
  const validTrip = {
    destination: "Paris, France",
    start_date: "2026-06-01",
    end_date: "2026-06-10",
  };

  it("accepts a valid trip", () => {
    const result = createTripSchema.safeParse(validTrip);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.destination).toBe("Paris, France");
      expect(result.data.status).toBe("draft");
    }
  });

  it("rejects missing destination", () => {
    const result = createTripSchema.safeParse({
      start_date: "2026-06-01",
      end_date: "2026-06-10",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("destination");
    }
  });

  it("rejects end date before start date", () => {
    const result = createTripSchema.safeParse({
      destination: "Paris, France",
      start_date: "2026-06-10",
      end_date: "2026-06-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(
        (i: { message: string }) => i.message,
      );
      expect(messages).toContain("End date must be on or after start date");
    }
  });

  it("accepts valid input with optional budget", () => {
    const result = createTripSchema.safeParse({
      ...validTrip,
      budget: 2500,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budget).toBe(2500);
    }
  });

  it("defaults status to draft when not provided", () => {
    const result = createTripSchema.safeParse(validTrip);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
    }
  });
});

// =============================================================================
// updateTripSchema
// =============================================================================

describe("updateTripSchema", () => {
  it("accepts a valid partial update", () => {
    const result = updateTripSchema.safeParse({
      destination: "Tokyo, Japan",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.destination).toBe("Tokyo, Japan");
    }
  });

  it("accepts an empty object", () => {
    const result = updateTripSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects end date before start date when both are provided", () => {
    const result = updateTripSchema.safeParse({
      start_date: "2026-06-10",
      end_date: "2026-06-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(
        (i: { message: string }) => i.message,
      );
      expect(messages).toContain("End date must be on or after start date");
    }
  });

  it("accepts when only one date is provided", () => {
    const result = updateTripSchema.safeParse({
      start_date: "2026-06-15",
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// activitySchema
// =============================================================================

describe("activitySchema", () => {
  it("accepts a valid activity", () => {
    const result = activitySchema.safeParse({
      time: "09:30",
      title: "Visit the Eiffel Tower",
      description: "Morning sightseeing",
      location: "Champ de Mars, Paris",
      duration_minutes: 120,
      cost: 25.5,
      category: "sightseeing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid time format (not HH:MM)", () => {
    const result = activitySchema.safeParse({
      time: "9:30am",
      title: "Visit the Eiffel Tower",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("time");
    }
  });

  it("rejects missing title", () => {
    const result = activitySchema.safeParse({
      time: "09:30",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("title");
    }
  });
});

// =============================================================================
// searchInputSchema
// =============================================================================

describe("searchInputSchema", () => {
  const validSearch = {
    destination: "Barcelona",
    startDate: "2026-07-01",
    endDate: "2026-07-14",
    travelers: 2,
  };

  it("accepts valid input", () => {
    const result = searchInputSchema.safeParse(validSearch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vibes).toEqual([]);
    }
  });

  it("rejects too many travelers (> 20)", () => {
    const result = searchInputSchema.safeParse({
      ...validSearch,
      travelers: 21,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("travelers");
    }
  });

  it("accepts valid input with optional fields", () => {
    const result = searchInputSchema.safeParse({
      ...validSearch,
      travelerType: "couple",
      vibes: ["romantic", "beach"],
      budget: "luxury",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.travelerType).toBe("couple");
      expect(result.data.vibes).toEqual(["romantic", "beach"]);
      expect(result.data.budget).toBe("luxury");
    }
  });
});

// =============================================================================
// trackClickSchema
// =============================================================================

describe("trackClickSchema", () => {
  const validClick = {
    itemType: "hotel" as const,
    itemId: "htl-123",
    itemName: "Grand Hotel Barcelona",
    affiliatePartner: "booking.com",
    affiliateUrl: "https://booking.com/hotel/grand-barcelona",
  };

  it("accepts a valid click", () => {
    const result = trackClickSchema.safeParse(validClick);
    expect(result.success).toBe(true);
  });

  it("rejects invalid affiliate URL", () => {
    const result = trackClickSchema.safeParse({
      ...validClick,
      affiliateUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("affiliateUrl");
    }
  });

  it("rejects when required fields are missing", () => {
    const result = trackClickSchema.safeParse({
      itemType: "hotel",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("itemId");
      expect(paths).toContain("itemName");
      expect(paths).toContain("affiliatePartner");
      expect(paths).toContain("affiliateUrl");
    }
  });
});

// =============================================================================
// paginationSchema
// =============================================================================

describe("paginationSchema", () => {
  it("defaults to page 1 and limit 10 for empty object", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
    }
  });

  it("coerces string values to numbers", () => {
    const result = paginationSchema.safeParse({
      page: "3",
      limit: "25",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(25);
    }
  });

  it("rejects limit greater than 100", () => {
    const result = paginationSchema.safeParse({
      page: 1,
      limit: 101,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(
        (i: { path: (string | number)[] }) => i.path.join("."),
      );
      expect(paths).toContain("limit");
    }
  });
});
