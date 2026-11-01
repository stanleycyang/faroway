/** Offline timing experiment. All minutes are local wall-clock minutes in one day. */
export interface TimingEvent {
  id: string;
  kind: "activity" | "meal" | "rest";
  durationMinutes: number;
  earliestStart: number;
  latestEnd: number;
  /** Reserved buffer, not a route-duration claim. */
  bufferBeforeMinutes: number;
}
export interface ProposedTiming extends TimingEvent {
  startMinute: number;
  endMinute: number;
}

/** Earliest placement is complete for this fixed-order, bounded-window problem.
 * No visits are dropped, reordered, shortened or silently moved across windows.
 * A fit does not establish opening hours, travel times or booking availability.
 */
export function proposeTiming(events: readonly TimingEvent[]) {
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
  const proposed: ProposedTiming[] = [];
  let cursor = 0;
  for (const event of events) {
    const startMinute = Math.max(
      event.earliestStart,
      cursor + event.bufferBeforeMinutes,
    );
    const endMinute = startMinute + event.durationMinutes;
    if (endMinute > event.latestEnd)
      return {
        fitsPolicy: false as const,
        verified: false as const,
        events: [] as ProposedTiming[],
        conflict: {
          eventId: event.id,
          earliestPossibleStart: startMinute,
          requiredEnd: endMinute,
          latestEnd: event.latestEnd,
          overrunMinutes: endMinute - event.latestEnd,
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
