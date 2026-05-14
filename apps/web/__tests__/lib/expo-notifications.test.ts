import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const fetchWithTimeoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/search/runtime", () => ({
  fetchWithTimeout: fetchWithTimeoutMock,
}));

import {
  sendExpoPushNotifications,
  sendItineraryReadyPush,
} from "@/lib/notifications/expo";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

function createDb({
  settings,
  tokens,
}: {
  settings: Record<string, boolean> | null;
  tokens: Array<{ token: string | null }>;
}) {
  const deleteInvalidTokens = vi.fn(async () => ({ error: null }));
  const db = {
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { notification_settings: settings },
                error: null,
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: tokens, error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: deleteInvalidTokens,
          })),
        })),
      };
    }),
  } as unknown as SupabaseClient;

  return { db, deleteInvalidTokens };
}

describe("Expo push notification helpers", () => {
  beforeEach(() => {
    fetchWithTimeoutMock.mockReset();
  });

  it("sends valid Expo push tokens and reports ticket failures", async () => {
    fetchWithTimeoutMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ status: "ok" }, { status: "error" }],
      }),
    );

    const result = await sendExpoPushNotifications([
      {
        to: "ExpoPushToken[valid_1]",
        title: "Ready",
        body: "Trip ready",
      },
      {
        to: "invalid-token",
        title: "Ready",
        body: "Trip ready",
      },
      {
        to: "ExponentPushToken[valid_2]",
        title: "Ready",
        body: "Trip ready",
      },
    ]);

    expect(result).toEqual({
      attempted: 2,
      sent: 1,
      failed: 1,
      skipped: 1,
      invalidTokens: [],
    });
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);
  });

  it("sends itinerary-ready pushes only for opted-in users", async () => {
    fetchWithTimeoutMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ status: "ok" }] }),
    );

    const result = await sendItineraryReadyPush(
      createDb({
        settings: { itinerary_updates: true },
        tokens: [
          { token: "ExpoPushToken[token_1]" },
          { token: "ExpoPushToken[token_1]" },
          { token: "bad-token" },
        ],
      }).db,
      {
        userId: "user-1",
        tripId: "trip-1",
        itineraryId: "itinerary-1",
        destination: "Tokyo",
      },
    );

    expect(result.sent).toBe(1);
    const [, init] = fetchWithTimeoutMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual([
      expect.objectContaining({
        to: "ExpoPushToken[token_1]",
        title: "Your itinerary is ready",
        data: expect.objectContaining({
          type: "trip_generation_complete",
          tripId: "trip-1",
          itineraryId: "itinerary-1",
        }),
      }),
    ]);
  });

  it("skips itinerary-ready pushes when the user has not opted in", async () => {
    const result = await sendItineraryReadyPush(
      createDb({
        settings: { itinerary_updates: false },
        tokens: [{ token: "ExpoPushToken[token_1]" }],
      }).db,
      {
        userId: "user-1",
        tripId: "trip-1",
        itineraryId: "itinerary-1",
        destination: "Tokyo",
      },
    );

    expect(result).toEqual({
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      invalidTokens: [],
    });
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
  });

  it("deletes Expo push tokens that are no longer registered", async () => {
    fetchWithTimeoutMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            status: "error",
            details: { error: "DeviceNotRegistered" },
          },
        ],
      }),
    );
    const { db, deleteInvalidTokens } = createDb({
      settings: { itinerary_updates: true },
      tokens: [{ token: "ExpoPushToken[stale_token]" }],
    });

    const result = await sendItineraryReadyPush(db, {
      userId: "user-1",
      tripId: "trip-1",
      itineraryId: "itinerary-1",
      destination: "Tokyo",
    });

    expect(result).toMatchObject({
      attempted: 1,
      sent: 0,
      failed: 1,
      invalidTokens: ["ExpoPushToken[stale_token]"],
    });
    expect(deleteInvalidTokens).toHaveBeenCalledWith("token", [
      "ExpoPushToken[stale_token]",
    ]);
  });
});
