import { getSupabase } from "@/lib/supabase/server";

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function formatDatabaseError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as DatabaseError).message);
  }
  return "Unknown database error";
}

function isOptionalSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as DatabaseError).code;
  return code === "42P01" || code === "42703";
}

async function requireSuccessfulQuery(
  label: string,
  query: PromiseLike<{ error: unknown }>,
  options: { optionalSchema?: boolean } = {},
): Promise<void> {
  const { error } = await query;

  if (!error) return;
  if (options.optionalSchema && isOptionalSchemaError(error)) return;

  throw new Error(`${label}: ${formatDatabaseError(error)}`);
}

async function fetchUserTrips(
  db: ReturnType<typeof getSupabase>,
  userId: string,
): Promise<Array<{ id: string; search_id: string | null }>> {
  const { data, error } = await db
    .from("trips")
    .select("id, search_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`fetch trips: ${formatDatabaseError(error)}`);
  }

  return (data || []) as Array<{ id: string; search_id: string | null }>;
}

async function fetchUserSearchIds(
  db: ReturnType<typeof getSupabase>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("searches")
    .select("id")
    .eq("user_id", userId);

  if (error) {
    if (isOptionalSchemaError(error)) return [];
    throw new Error(`fetch searches: ${formatDatabaseError(error)}`);
  }

  return ((data || []) as Array<{ id: string }>).map((row) => row.id);
}

async function fetchAffiliateClickIdsForDeletion(
  db: ReturnType<typeof getSupabase>,
  userId: string,
  tripIds: string[],
): Promise<string[]> {
  const ids = new Set<string>();

  const addRows = (rows: unknown) => {
    for (const row of (rows || []) as Array<{ id?: unknown }>) {
      if (typeof row.id === "string") ids.add(row.id);
    }
  };

  const byUser = await db
    .from("affiliate_clicks")
    .select("id")
    .eq("user_id", userId);
  if (byUser.error) {
    if (!isOptionalSchemaError(byUser.error)) {
      throw new Error(
        `fetch affiliate clicks by user: ${formatDatabaseError(byUser.error)}`,
      );
    }
  } else {
    addRows(byUser.data);
  }

  if (tripIds.length > 0) {
    const byTrip = await db
      .from("affiliate_clicks")
      .select("id")
      .in("trip_id", tripIds);
    if (byTrip.error) {
      if (!isOptionalSchemaError(byTrip.error)) {
        throw new Error(
          `fetch affiliate clicks by trip: ${formatDatabaseError(byTrip.error)}`,
        );
      }
    } else {
      addRows(byTrip.data);
    }
  }

  return [...ids];
}

async function deleteByUserId(
  db: ReturnType<typeof getSupabase>,
  table: string,
  userId: string,
  options: { optionalSchema?: boolean } = {},
): Promise<void> {
  await deleteByValue(db, table, "user_id", userId, options);
}

async function deleteByValue(
  db: ReturnType<typeof getSupabase>,
  table: string,
  column: string,
  value: string,
  options: { optionalSchema?: boolean } = {},
): Promise<void> {
  await requireSuccessfulQuery(
    `delete ${table}`,
    db.from(table).delete().eq(column, value),
    options,
  );
}

async function deleteByIds(
  db: ReturnType<typeof getSupabase>,
  table: string,
  column: string,
  ids: string[],
  options: { optionalSchema?: boolean } = {},
): Promise<void> {
  if (ids.length === 0) return;

  await requireSuccessfulQuery(
    `delete ${table}`,
    db.from(table).delete().in(column, ids),
    options,
  );
}

export async function purgeAccountData(
  db: ReturnType<typeof getSupabase>,
  userId: string,
) {
  const trips = await fetchUserTrips(db, userId);
  const tripIds = trips.map((trip) => trip.id);
  const affiliateClickIds = await fetchAffiliateClickIdsForDeletion(
    db,
    userId,
    tripIds,
  );
  const searchIds = [
    ...new Set([
      ...trips
        .map((trip) => trip.search_id)
        .filter((id): id is string => Boolean(id)),
      ...(await fetchUserSearchIds(db, userId)),
    ]),
  ];

  await deleteByUserId(db, "push_tokens", userId, { optionalSchema: true });
  await deleteByUserId(db, "notifications", userId, {
    optionalSchema: true,
  });
  await deleteByValue(db, "realtime_events", "channel", `user:${userId}`, {
    optionalSchema: true,
  });
  await deleteByUserId(db, "saved_activities", userId, {
    optionalSchema: true,
  });
  await deleteByUserId(db, "workflow_runs", userId, {
    optionalSchema: true,
  });
  await deleteByUserId(db, "workflow_progress", userId, {
    optionalSchema: true,
  });
  await deleteByUserId(db, "affiliate_conversions", userId, {
    optionalSchema: true,
  });
  await deleteByIds(
    db,
    "affiliate_conversions",
    "click_id",
    affiliateClickIds,
    {
      optionalSchema: true,
    },
  );
  await deleteByUserId(db, "affiliate_clicks", userId, {
    optionalSchema: true,
  });
  await deleteByIds(db, "workflow_runs", "trip_id", tripIds, {
    optionalSchema: true,
  });
  await deleteByIds(db, "workflow_progress", "trip_id", tripIds, {
    optionalSchema: true,
  });
  await deleteByIds(db, "saved_activities", "trip_id", tripIds, {
    optionalSchema: true,
  });
  await deleteByIds(db, "affiliate_clicks", "trip_id", tripIds, {
    optionalSchema: true,
  });
  await deleteByIds(db, "search_results", "search_id", searchIds, {
    optionalSchema: true,
  });
  await deleteByIds(db, "search_itineraries", "search_id", searchIds, {
    optionalSchema: true,
  });
  await deleteByIds(db, "searches", "id", searchIds, {
    optionalSchema: true,
  });
  await deleteByIds(db, "itineraries", "trip_id", tripIds);
  await deleteByUserId(db, "trips", userId);
  await requireSuccessfulQuery(
    "delete user profile",
    db.from("users").delete().eq("id", userId),
  );
}
