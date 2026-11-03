/** Deterministic extraction of published JSON-LD. No network, code execution or
 * model calls. A listed event is not evidence of tickets, duration or suitability.
 */
export interface PublishedEvent {
  name: string;
  venueName?: string;
  startDate: string;
  localDate: string;
  localTime: string;
  reportedEndDate?: string;
  durationMinutes?: number;
  status: "cancelled" | "postponed" | "scheduled" | "unspecified";
  sourceUrl: string;
  observedAt: string;
  issues: string[];
  ticketAvailability: "unknown";
  claimVerified: false;
}
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
function timestamp(value: unknown): string | undefined {
  const raw = text(value);
  const match =
    raw &&
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      raw,
    );
  if (
    !match ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4]) > 59
  )
    return undefined;
  const day = new Date(`${match[1]}T00:00:00Z`);
  if (
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== match[1]
  )
    return undefined;
  if (match[5] !== "Z") {
    const [hours, minutes] = match[5].slice(1).split(":").map(Number);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0))
      return undefined;
  }
  return Number.isFinite(Date.parse(raw!)) ? raw! : undefined;
}
const schemaType = (value: string) =>
  value.replace(/^https?:\/\/schema\.org\//, "");
// Scan forward once; repeated unclosed script tags must not trigger repeated
// full-document regex backtracking on untrusted pages.
function* scriptsIn(html: string): Generator<[string, string]> {
  const start = /<script\b/gi;
  const close = /<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = start.exec(html))) {
    const endOfTag = html.indexOf(">", start.lastIndex);
    if (endOfTag < 0) return;
    close.lastIndex = endOfTag + 1;
    const closing = close.exec(html);
    if (!closing) return;
    yield [
      html.slice(start.lastIndex, endOfTag),
      html.slice(endOfTag + 1, closing.index),
    ];
    start.lastIndex = close.lastIndex;
  }
}

export function extractPublishedEvents(input: {
  html: string;
  sourceUrl: string;
  observedAt: string;
  approvedSourceUrls: readonly string[];
}) {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.username ||
    source.password ||
    !input.approvedSourceUrls.includes(input.sourceUrl)
  )
    throw new Error("Source is not an approved HTTPS page");
  if (!timestamp(input.observedAt))
    throw new Error("A timezone-qualified observation timestamp is required");
  if (input.html.length > 1_000_000)
    throw new Error("Event source exceeds size limit");
  const events: PublishedEvent[] = [];
  const issues: string[] = [];
  let scripts = 0;
  let visited = 0;
  const identities = new Set<string>();
  for (const script of scriptsIn(input.html)) {
    if (!/(?:^|\s)type\s*=\s*["']application\/ld\+json["']/i.test(script[0]))
      continue;
    if (++scripts > 32) throw new Error("Too many structured-data scripts");
    let root: unknown;
    try {
      root = JSON.parse(script[1]);
    } catch {
      issues.push("malformed_json_ld");
      continue;
    }
    const queue: Array<{ value: unknown; depth: number }> = [
      { value: root, depth: 0 },
    ];
    for (let index = 0; index < queue.length; index++) {
      const { value, depth } = queue[index];
      if (++visited > 2048 || depth > 20)
        throw new Error("Structured-data traversal limit exceeded");
      if (!value || typeof value !== "object") continue;
      if (Array.isArray(value)) {
        for (const item of value) queue.push({ value: item, depth: depth + 1 });
        continue;
      }
      const node = value as Record<string, unknown>;
      for (const child of Object.values(node))
        if (child && typeof child === "object")
          queue.push({ value: child, depth: depth + 1 });
      const types = Array.isArray(node["@type"])
        ? node["@type"]
        : [node["@type"]];
      if (
        !types.some(
          (t) =>
            typeof t === "string" &&
            [
              "Event",
              "MusicEvent",
              "TheaterEvent",
              "DanceEvent",
              "Festival",
            ].includes(schemaType(t)),
        )
      )
        continue;
      const name = text(node.name);
      const start = timestamp(node.startDate);
      if (!name || !start) {
        issues.push("event_missing_name_or_timezone_qualified_start");
        continue;
      }
      const location =
        node.location &&
        typeof node.location === "object" &&
        !Array.isArray(node.location)
          ? (node.location as Record<string, unknown>)
          : {};
      const venueName = text(location.name);
      const eventIssues: string[] = [];
      if (!venueName) eventIssues.push("venue_name_missing");
      const end = timestamp(node.endDate);
      let durationMinutes: number | undefined;
      if (node.endDate !== undefined && !end)
        eventIssues.push("invalid_reported_end");
      if (end) {
        const duration = (Date.parse(end) - Date.parse(start)) / 60000;
        if (duration > 0 && duration <= 1440 && Number.isInteger(duration))
          durationMinutes = duration;
        else
          eventIssues.push(
            "reported_end_does_not_establish_single_day_duration",
          );
      }
      if (durationMinutes === undefined)
        eventIssues.push("duration_unverified");
      const rawStatus = text(node.eventStatus);
      const status = rawStatus ? schemaType(rawStatus) : undefined;
      const identity = JSON.stringify([name, start, venueName]);
      if (identities.has(identity)) {
        issues.push("duplicate_event_identity");
        continue;
      }
      identities.add(identity);
      events.push({
        name,
        venueName,
        startDate: start,
        localDate: start.slice(0, 10),
        localTime: start.slice(11, 16),
        reportedEndDate: end,
        durationMinutes,
        status:
          status === "EventCancelled"
            ? "cancelled"
            : status === "EventPostponed"
              ? "postponed"
              : status === "EventScheduled"
                ? "scheduled"
                : "unspecified",
        sourceUrl: input.sourceUrl,
        observedAt: input.observedAt,
        issues: eventIssues,
        ticketAvailability: "unknown",
        claimVerified: false,
      });
    }
  }
  if (!scripts) issues.push("no_json_ld_scripts");
  if (!events.length) issues.push("no_extractable_events");
  return {
    events,
    issues,
    sourceOwnershipVerified: false as const,
    futureAvailabilityVerified: false as const,
  };
}
