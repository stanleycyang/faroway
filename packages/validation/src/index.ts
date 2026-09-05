/**
 * @faroway/validation
 * Shared Zod validation schemas for Faroway.
 * Uses zod/v3 import for v3/v4 compatibility during transition.
 */

import { z } from "zod/v3";

// =============================================================================
// Common Schemas
// =============================================================================

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const emailSchema = z
  .string()
  .email("Invalid email format")
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be less than 100 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  );

export const dateSchema = z.string().refine(
  (val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  },
  { message: "Invalid date format" },
);

// =============================================================================
// Auth Schemas
// =============================================================================

export const registerSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be less than 255 characters")
    .trim(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// =============================================================================
// Trip Schemas
// =============================================================================

export const tripStatusSchema = z.enum([
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
]);

export const budgetLevelSchema = z.enum(["budget", "moderate", "luxury"]);

export const travelerTypeSchema = z.enum([
  "solo",
  "couple",
  "family",
  "friends",
  "business",
]);

export const createTripSchema = z
  .object({
    destination: z
      .string()
      .min(1, "Destination is required")
      .max(500, "Destination must be less than 500 characters")
      .trim(),
    start_date: dateSchema,
    end_date: dateSchema,
    budget: z.number().positive("Budget must be positive").optional(),
    status: tripStatusSchema.optional().default("draft"),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      return end >= start;
    },
    {
      message: "End date must be on or after start date",
      path: ["end_date"],
    },
  );

export const updateTripSchema = z
  .object({
    destination: z.string().min(1).max(500).trim().optional(),
    start_date: dateSchema.optional(),
    end_date: dateSchema.optional(),
    budget: z.number().positive().optional(),
    status: tripStatusSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        return end >= start;
      }
      return true;
    },
    {
      message: "End date must be on or after start date",
      path: ["end_date"],
    },
  );

// =============================================================================
// Itinerary Schemas
// =============================================================================

export const activitySchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  title: z.string().min(1, "Activity title is required").max(255),
  description: z.string().max(2000).default(""),
  location: z.string().max(500).optional(),
  duration_minutes: z.number().positive().optional(),
  cost: z.number().min(0).optional(),
  category: z.string().max(100).optional(),
});

export const createItinerarySchema = z.object({
  trip_id: uuidSchema,
  day_number: z.number().int().positive("Day number must be positive"),
  activities: z.array(activitySchema).default([]),
  notes: z.string().max(5000).optional(),
});

export const updateItinerarySchema = z.object({
  activities: z.array(activitySchema).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// =============================================================================
// Preferences Schemas
// =============================================================================

export const travelStyleSchema = z.enum([
  "budget",
  "mid_range",
  "luxury",
  "backpacker",
  "business",
]);

export const updatePreferencesSchema = z.object({
  interests: z.array(z.string().max(100)).max(50).optional(),
  travel_style: travelStyleSchema.nullable().optional(),
  dietary_restrictions: z.array(z.string().max(100)).max(20).optional(),
});

// =============================================================================
// Query Schemas
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const tripQuerySchema = paginationSchema.extend({
  status: tripStatusSchema.optional(),
  destination: z.string().optional(),
});

// =============================================================================
// Search Schemas
// =============================================================================

export const searchInputSchema = z.object({
  destination: z.string().min(1, "Destination is required").max(500),
  startDate: dateSchema,
  endDate: dateSchema,
  travelers: z.number().int().positive().max(20),
  travelerType: travelerTypeSchema.optional(),
  vibes: z.array(z.string()).default([]),
  budget: budgetLevelSchema.optional(),
});

// =============================================================================
// Affiliate Schemas
// =============================================================================

export const trackClickSchema = z.object({
  itemType: z.enum(["hotel", "activity", "restaurant", "flight", "transport"]),
  itemId: z.string().min(1).max(500),
  itemName: z.string().min(1).max(500),
  affiliatePartner: z.string().min(1).max(50),
  affiliateUrl: z.string().url().max(2000),
  searchId: z.string().optional(),
  tripId: z.string().optional(),
  price: z.number().finite().nonnegative().optional(),
  currency: z.string().min(1).max(10).optional(),
  source: z
    .enum(["search_results", "trip_view", "itinerary", "email"])
    .optional(),
});

// =============================================================================
// Type Exports (inferred from schemas)
// =============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateItineraryInput = z.infer<typeof createItinerarySchema>;
export type UpdateItineraryInput = z.infer<typeof updateItinerarySchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type TripQuery = z.infer<typeof tripQuerySchema>;
export type SearchInputValidated = z.infer<typeof searchInputSchema>;
export type TrackClickInput = z.infer<typeof trackClickSchema>;
