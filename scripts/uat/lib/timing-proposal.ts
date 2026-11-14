/** Offline timing experiment. All minutes are local wall-clock minutes in one day. */
export interface TimingEvent {
  id: string;
  kind: "activity" | "meal" | "rest";
  durationMinutes: number;
  earliestStart: number;
  latestEnd: number;
  /** Reserved buffer, not a route-duration claim. */
  bufferBeforeMinutes: number;
  /** Optional independently supplied operating windows; never inferred from model prose. */
  allowedIntervals?: ReadonlyArray<readonly [number, number]>;
}
export interface ProposedTiming extends TimingEvent {
  startMinute: number;
  endMinute: number;
}

/** Earliest placement is complete for this fixed-order, bounded-window problem.
 * No visits are dropped, reordered, shortened or silently moved across windows.
 * A fit does not establish opening hours, travel times or booking availability.
 */
export function proposeTiming(
  events: readonly TimingEvent[],
  unavailable: ReadonlyArray<readonly [number, number]> = [],
) {
  if (
    unavailable.some(
      ([a, b]) =>
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        a < 0 ||
        b > 1440 ||
        a >= b,
    )
  )
    throw new Error("Invalid unavailable interval");
  const blocked = [...unavailable].sort((a, b) => a[0] - b[0]);
  if (!events.length) throw new Error("Nonempty event list required");
  const ids = new Set<string>();
  for (const event of events) {
    if (!event.id.trim() || ids.has(event.id))
      throw new Error("Unique event IDs required");
    ids.add(event.id);
    if (
      ![
        event.durationMinutes,
        event.earliestStart,
        event.latestEnd,
        event.bufferBeforeMinutes,
      ].every(Number.isInteger) ||
      event.durationMinutes <= 0 ||
      event.bufferBeforeMinutes < 0 ||
      event.earliestStart < 0 ||
      event.latestEnd > 1440 ||
      event.earliestStart >= event.latestEnd
    )
      throw new Error("Invalid day timing constraint");
  }
  for (const event of events) {
    if (
      event.allowedIntervals?.some(
        ([a, b]) =>
          !Number.isInteger(a) ||
          !Number.isInteger(b) ||
          a < 0 ||
          b > 1440 ||
          a >= b,
      )
    )
      throw new Error("Invalid event operating interval");
  }
  const proposed: ProposedTiming[] = [];
  let cursor = 0;
  for (const event of events) {
    const windows =
      event.allowedIntervals === undefined
        ? [[event.earliestStart, event.latestEnd] as const]
        : [...event.allowedIntervals].sort((a, b) => a[0] - b[0]);
    let startMinute = Math.max(
      event.earliestStart,
      cursor + event.bufferBeforeMinutes,
    );
    // An explicitly empty operating calendar leaves no schedulable interval.
    let latestEnd = windows.length ? event.latestEnd : startMinute;
    let fits = false;
    for (const [opens, closes] of windows) {
      startMinute = Math.max(
        event.earliestStart,
        opens,
        cursor + event.bufferBeforeMinutes,
      );
      latestEnd = Math.min(event.latestEnd, closes);
      for (const [start, end] of blocked)
        if (
          startMinute - event.bufferBeforeMinutes < end &&
          startMinute + event.durationMinutes > start
        )
          startMinute = end + event.bufferBeforeMinutes;
      if (startMinute + event.durationMinutes <= latestEnd) {
        fits = true;
        break;
      }
    }
    const endMinute = startMinute + event.durationMinutes;
    if (!fits)
      return {
        fitsPolicy: false as const,
        verified: false as const,
        events: [] as ProposedTiming[],
        conflict: {
          eventId: event.id,
          earliestPossibleStart: startMinute,
          requiredEnd: endMinute,
          latestEnd,
          overrunMinutes: endMinute - latestEnd,
        },
      };
    proposed.push({ ...event, startMinute, endMinute });
    cursor = endMinute;
  }
  return {
    fitsPolicy: true as const,
    verified: false as const,
    events: proposed,
    conflict: null,
  };
}
