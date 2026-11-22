import React from "react";
import { createRoot } from "react-dom/client";
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
  AFFILIATE_PARTNERS,
  AFFILIATE_PARTNER_IDS,
  BUDGET_TIERS,
  injectAffiliateSubId,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  normalizeBudgetTier,
  normalizeVibeList,
  resolveAffiliatePartnerByUrl,
  travelVibes,
} from "@faroway/constants";
import {
  budgetTierInputSchema,
  conversionWebhookSchema,
  normalizedTravelVibeSchema,
  trackClickSchema,
} from "@faroway/validation";
import type { TripDay } from "@faroway/types";
import { SharedTripView } from "../../components/trips/SharedTripView";
import { ViatorContentPolicy } from "../../components/trips/ViatorContentPolicy";

declare global {
  interface Window {
    __MONETIZATION_CONTRACTS__?: {
      AFFILIATE_PARTNER_IDS: typeof AFFILIATE_PARTNER_IDS;
      AFFILIATE_PARTNERS: typeof AFFILIATE_PARTNERS;
      AFFILIATE_DISCLOSURE_SHORT: string;
      AFFILIATE_DISCLOSURE_FULL: string;
      BUDGET_TIERS: typeof BUDGET_TIERS;
      travelVibes: typeof travelVibes;
      injectAffiliateSubId: typeof injectAffiliateSubId;
      isAllowedAffiliateUrl: typeof isAllowedAffiliateUrl;
      normalizeAffiliatePartner: typeof normalizeAffiliatePartner;
      resolveAffiliatePartnerByUrl: typeof resolveAffiliatePartnerByUrl;
      normalizeVibeList: typeof normalizeVibeList;
      normalizeBudgetTier: typeof normalizeBudgetTier;
      validateTrackClick: (payload: unknown) => boolean;
      validateConversionWebhook: (payload: unknown) => boolean;
      parseBudgetTierInput: (
        value: unknown,
      ) => { success: true; data: string } | { success: false };
      parseNormalizedTravelVibe: (
        value: unknown,
      ) => { success: true; data: string } | { success: false };
    };
  }
}

window.__MONETIZATION_CONTRACTS__ = {
  AFFILIATE_PARTNER_IDS,
  AFFILIATE_PARTNERS,
  AFFILIATE_DISCLOSURE_SHORT,
  AFFILIATE_DISCLOSURE_FULL,
  BUDGET_TIERS,
  travelVibes,
  injectAffiliateSubId,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  resolveAffiliatePartnerByUrl,
  normalizeVibeList,
  normalizeBudgetTier,
  validateTrackClick: (payload: unknown) =>
    trackClickSchema.safeParse(payload).success,
  validateConversionWebhook: (payload: unknown) =>
    conversionWebhookSchema.safeParse(payload).success,
  parseBudgetTierInput: (value: unknown) => {
    const res = budgetTierInputSchema.safeParse(value);
    return res.success ? { success: true, data: res.data } : { success: false };
  },
  parseNormalizedTravelVibe: (value: unknown) => {
    const res = normalizedTravelVibeSchema.safeParse(value);
    return res.success ? { success: true, data: res.data } : { success: false };
  },
};

const sampleSharedDays: TripDay[] = [
  {
    dayNumber: 1,
    date: "2099-07-10",
    title: "Asakusa & Ueno Heritage",
    summary: "Morning temple walk followed by artisan crafts and dining.",
    morning: {
      activities: [
        {
          id: "activity_v_TOKYO1",
          name: "Senso-ji Morning Cultural Walk",
          description: "Guided walk through Asakusa's historic temple grounds.",
          duration: 120,
          estimatedCost: { amount: 48, status: "estimate", currency: "USD" },
          timeOfDay: "morning",
          category: "cultural",
          location: { name: "Senso-ji Temple", address: "Asakusa, Tokyo" },
          bookingInfo: {
            requiresReservation: true,
            affiliateId: "viator",
            bookingUrl:
              "https://www.viator.com/tours/Tokyo/Asakusa/d334-TOKYO1?pid=P12345678&mcid=42383&medium=api",
          },
          vibeMatch: {
            matchedVibes: ["culture"],
            reasoning: "Historic temple district tour matching Culture vibe.",
          },
          viatorContentVersion: 1,
        } as TripDay["morning"]["activities"][number] & {
          viatorContentVersion: number;
        },
      ],
      meals: [
        {
          id: "meal_asakusa_1",
          name: "Asakusa Soba House",
          cuisineType: ["Japanese", "Soba"],
          description: "Handmade buckwheat noodles near Kaminarimon.",
          estimatedCost: {
            amount: 18,
            status: "estimate",
            currency: "USD",
            perPerson: true,
          },
          mealType: "lunch",
          location: { name: "Asakusa" },
          dietaryOptions: ["Vegetarian options"],
          vibeMatch: {
            matchedVibes: ["foodie"],
            reasoning: "Neighborhood artisan soba matching Foodie vibe.",
          },
          reservationInfo: { recommended: false },
        },
      ],
    },
    afternoon: {
      activities: [
        {
          id: "act_gyg_ueno",
          name: "Tokyo National Museum Entry",
          description: "Explore Japanese art and samurai heritage galleries.",
          duration: 90,
          estimatedCost: { amount: 15, status: "estimate", currency: "USD" },
          timeOfDay: "afternoon",
          category: "cultural",
          location: { name: "Ueno Park" },
          vibeMatch: {
            matchedVibes: ["culture"],
            reasoning: "Premier Japanese art & history collection.",
          },
          bookingInfo: {
            requiresReservation: true,
            affiliateId: "getyourguide",
            bookingUrl:
              "https://www.getyourguide.com/tokyo-l193/ueno-museum-t998/?partner_id=TEST",
          },
        },
      ],
      meals: [],
    },
    evening: { activities: [], meals: [] },
    tips: ["Arrive before 9 AM for quieter temple paths."],
  },
];

function MonetizationSurfacesFixture() {
  const screen = new URLSearchParams(location.search).get("screen") || "shared";
  const isRevoked = screen === "revoked";

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <ViatorContentPolicy enabled={true}>
        <SharedTripView
          destination="Tokyo, Japan"
          startDate="2099-07-10"
          endDate="2099-07-12"
          travelers={3}
          travelerType="friends"
          vibes={["culture", "foodie"]}
          budgetTier="moderate"
          itinerary={
            isRevoked
              ? null
              : {
                  days: sampleSharedDays,
                  overview:
                    "Three days balancing Tokyo heritage neighborhoods and food markets.",
                  totalEstimatedCost: { amount: 1450, currency: "USD" },
                  packingList: ["Comfortable walking shoes", "IC transit card"],
                  generalTips: [
                    "Carry small yen notes for neighborhood stalls.",
                  ],
                  generatedAt: "2099-01-01T00:00:00Z",
                }
          }
          shareToken="share-tok-123"
          shareUrl="http://127.0.0.1/s/share-tok-123"
        />
      </ViatorContentPolicy>

      <section
        aria-label="Brand contrast verification swatches"
        className="mx-auto max-w-4xl space-y-3 px-4 py-6"
      >
        <div className="flex flex-wrap gap-3">
          <span
            data-testid="swatch-primary-700-solid"
            className="rounded-lg bg-primary-700 px-3 py-2 text-sm font-semibold text-white"
          >
            Primary Action Coral (bg-primary-700 text-white)
          </span>
          <span
            data-testid="swatch-primary-800-solid"
            className="rounded-lg bg-primary-800 px-3 py-2 text-sm font-semibold text-white"
          >
            Deep Action Coral (bg-primary-800 text-white)
          </span>
          <span
            data-testid="swatch-primary-700-white"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700"
          >
            Primary Action Coral (text-primary-700 bg-white)
          </span>
          <span
            data-testid="swatch-primary-800-paper"
            className="rounded-lg border border-slate-200 bg-[#FAF8F3] px-3 py-2 text-sm font-semibold text-primary-800"
          >
            Deep Action Coral (text-primary-800 bg-[#FAF8F3])
          </span>
          <span
            data-testid="swatch-ocean-teal-solid"
            className="rounded-lg bg-[#143D46] px-3 py-2 text-sm font-semibold text-white"
          >
            Ocean Teal (bg-[#143D46] text-white)
          </span>
        </div>
        <p data-testid="disclosure-short" className="text-xs text-slate-700">
          {AFFILIATE_DISCLOSURE_SHORT}
        </p>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <MonetizationSurfacesFixture />,
);
