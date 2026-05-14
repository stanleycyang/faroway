import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { fetchWithTimeout } from "@/lib/search/runtime";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TOKEN_PATTERN =
  /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/;
const EXPO_PUSH_CHUNK_SIZE = 100;
const EXPO_PUSH_TIMEOUT_MS = 3000;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
}

export interface ExpoPushResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  invalidTokens: string[];
}

type PushTokenRow = {
  token: string | null;
};

type UserNotificationSettingsRow = {
  notification_settings: Record<string, boolean> | null;
};

type ExpoTicket = {
  status?: "ok" | "error";
  details?: {
    error?: string;
  };
};

function isExpoPushToken(token: string | null | undefined): token is string {
  return Boolean(token && EXPO_PUSH_TOKEN_PATTERN.test(token));
}

function chunks<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
}

function countTickets(body: unknown, batch: ExpoPushMessage[]) {
  if (
    !body ||
    typeof body !== "object" ||
    !("data" in body) ||
    !Array.isArray(body.data)
  ) {
    return { sent: 0, failed: batch.length, invalidTokens: [] };
  }

  return body.data.reduce(
    (
      totals: { sent: number; failed: number; invalidTokens: string[] },
      ticket: ExpoTicket,
      index: number,
    ) => {
      if (ticket?.status === "ok") {
        totals.sent += 1;
      } else {
        totals.failed += 1;
        if (ticket?.details?.error === "DeviceNotRegistered") {
          const token = batch[index]?.to;
          if (token) {
            totals.invalidTokens.push(token);
          }
        }
      }
      return totals;
    },
    { sent: 0, failed: 0, invalidTokens: [] },
  );
}

export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<ExpoPushResult> {
  const validMessages = messages.filter((message) =>
    isExpoPushToken(message.to),
  );
  const result: ExpoPushResult = {
    attempted: validMessages.length,
    sent: 0,
    failed: 0,
    skipped: messages.length - validMessages.length,
    invalidTokens: [],
  };

  for (const batch of chunks(validMessages, EXPO_PUSH_CHUNK_SIZE)) {
    try {
      const response = await fetchWithTimeout(
        EXPO_PUSH_API_URL,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batch),
        },
        EXPO_PUSH_TIMEOUT_MS,
      );

      if (!response.ok) {
        result.failed += batch.length;
        continue;
      }

      const body = await response.json().catch(() => null);
      const counts = countTickets(body, batch);
      result.sent += counts.sent;
      result.failed += counts.failed;
      result.invalidTokens.push(...counts.invalidTokens);
    } catch {
      result.failed += batch.length;
    }
  }

  result.invalidTokens = Array.from(new Set(result.invalidTokens));

  return result;
}

async function deleteInvalidPushTokens(
  db: SupabaseClient,
  userId: string,
  tokens: string[],
) {
  if (tokens.length === 0) return;

  const { error } = await db
    .from("push_tokens")
    .delete()
    .eq("user_id", userId)
    .in("token", tokens);

  if (error) {
    logger.warn("[Expo Push] Failed to delete invalid push tokens:", error);
  }
}

export async function sendItineraryReadyPush(
  db: SupabaseClient,
  {
    userId,
    tripId,
    itineraryId,
    destination,
  }: {
    userId: string;
    tripId: string;
    itineraryId: string;
    destination: string;
  },
): Promise<ExpoPushResult> {
  const { data: settingsRow, error: settingsError } = await db
    .from("users")
    .select("notification_settings")
    .eq("id", userId)
    .single<UserNotificationSettingsRow>();

  if (
    settingsError ||
    settingsRow?.notification_settings?.itinerary_updates !== true
  ) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 0, invalidTokens: [] };
  }

  const { data, error } = await db
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);

  if (error || !Array.isArray(data)) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 0, invalidTokens: [] };
  }

  const tokens = Array.from(
    new Set(
      (data as PushTokenRow[]).map((row) => row.token).filter(isExpoPushToken),
    ),
  );

  const result = await sendExpoPushNotifications(
    tokens.map((token) => ({
      to: token,
      sound: "default",
      title: "Your itinerary is ready",
      body: `Your ${destination} itinerary is ready to view.`,
      data: {
        type: "trip_generation_complete",
        tripId,
        itineraryId,
      },
    })),
  );

  await deleteInvalidPushTokens(db, userId, result.invalidTokens);

  return result;
}
