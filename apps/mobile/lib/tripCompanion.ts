import { localCalendarDate, tripDatePhase, travelVibes } from '@faroway/constants';
import type { TravelerRequirements } from '@faroway/types';
import { transformItineraryDays } from './itineraryNormalization';
import { parseTripDate } from './tripDate';
import type { Activity, TripDay } from './itineraryTypes';
import type { Trip } from './tripTypes';

// ─── 1. "Up Next" Active-Day Stop Detection ─────────────────────────────────

export interface UpNextStatus {
  isActiveTrip: boolean;
  dayIndex: number;
  dayNumber: number;
  totalDays: number;
  nextStop: Activity | null;
  followingStop: Activity | null;
  scheduledLabel: string | null;
}

function parseExplicitClockMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(raw.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toLowerCase();
  if (period === 'pm' && hour < 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
    return hour * 60 + minute;
  }
  return null;
}

function slotBaseMinutes(activity: Activity): number {
  const explicitClock = parseExplicitClockMinutes(activity.time);
  if (explicitClock !== null) return explicitClock;
  const slot = (activity.scheduleSlot || activity.time || '').toLowerCase();
  if (slot.includes('breakfast') || slot.includes('morning')) return 9 * 60 + 30;
  if (slot.includes('lunch') || slot.includes('afternoon')) return 13 * 60 + 30;
  if (slot.includes('dinner') || slot.includes('evening') || slot.includes('night')) {
    return 18 * 60 + 30;
  }
  return 11 * 60;
}

function slotDisplayLabel(activity: Activity): string {
  const slot = (activity.scheduleSlot || activity.time || '').toLowerCase();
  if (slot.includes('morning') || slot.includes('breakfast')) return 'Morning';
  if (slot.includes('afternoon') || slot.includes('lunch')) return 'Afternoon';
  if (slot.includes('evening') || slot.includes('dinner') || slot.includes('night')) {
    return 'Evening';
  }
  return 'Scheduled';
}

export function formatMinutesAsClock(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${period}`;
}

function resolveActivityTiming(
  day: TripDay,
  activity: Activity,
  indexInDay: number,
  shiftMinutes: number
): { startMin: number; hasClockTime: boolean } {
  const proposal = day.timingProposal;
  if (proposal) {
    const eventId =
      activity.type === 'restaurant'
        ? `meal:${activity.scheduleSlot}:${activity.id}`
        : `activity:${activity.id}`;
    const event = proposal.events.find((e) => e.id === eventId);
    if (event && Number.isFinite(event.startMinute)) {
      return {
        startMin: Math.min(23 * 60 + 45, Math.max(0, event.startMinute + shiftMinutes)),
        hasClockTime: true,
      };
    }
  }
  const explicitClock = parseExplicitClockMinutes(activity.time);
  if (explicitClock !== null) {
    return {
      startMin: Math.min(23 * 60 + 45, Math.max(0, explicitClock + shiftMinutes)),
      hasClockTime: true,
    };
  }
  return {
    startMin: Math.min(
      23 * 60 + 45,
      Math.max(0, slotBaseMinutes(activity) + indexInDay * 35 + shiftMinutes)
    ),
    hasClockTime: false,
  };
}

function calendarDayOrdinalUtc(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function detectUpNextStop(
  trip: Trip,
  now: Date = new Date(),
  shiftMinutes = 0
): UpNextStatus {
  const totalDays = trip.days.length;
  const empty: UpNextStatus = {
    isActiveTrip: false,
    dayIndex: 0,
    dayNumber: 1,
    totalDays,
    nextStop: null,
    followingStop: null,
    scheduledLabel: null,
  };

  if (totalDays === 0) return empty;

  const today = localCalendarDate(now);
  const phase = tripDatePhase(trip.startDate, trip.endDate, today);
  const matchingDayIndex = trip.days.findIndex(
    (d) => typeof d.date === 'string' && d.date.slice(0, 10) === today
  );

  if (phase !== 'in-progress' && matchingDayIndex === -1) {
    return empty;
  }

  let dayIndex = matchingDayIndex;
  if (dayIndex === -1) {
    const startOrd = calendarDayOrdinalUtc(trip.startDate);
    const todayOrd = calendarDayOrdinalUtc(today);
    if (startOrd !== null && todayOrd !== null) {
      dayIndex = Math.max(0, Math.min(totalDays - 1, todayOrd - startOrd));
    } else {
      const start = parseTripDate(trip.startDate);
      const todayDate = parseTripDate(today);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(todayDate.getTime())) {
        const diff = Math.round((todayDate.getTime() - start.getTime()) / 86_400_000);
        dayIndex = Math.max(0, Math.min(totalDays - 1, diff));
      } else {
        dayIndex = 0;
      }
    }
  }

  const activeDay = trip.days[dayIndex];
  const stops = activeDay?.activities ?? [];
  if (stops.length === 0) {
    return {
      isActiveTrip: true,
      dayIndex,
      dayNumber: activeDay.dayNumber,
      totalDays,
      nextStop: null,
      followingStop: null,
      scheduledLabel: null,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduled = stops.map((stop, idx) => ({
    stop,
    ...resolveActivityTiming(activeDay, stop, idx, shiftMinutes),
  }));

  // Pick the first stop that hasn't clearly passed (allow 45m grace window so current stop stays highlighted)
  let nextIdx = scheduled.findIndex((item) => item.startMin + 45 >= nowMinutes);
  if (nextIdx === -1) {
    nextIdx = scheduled.length - 1;
  }

  const chosen = scheduled[nextIdx];
  const following = scheduled[nextIdx + 1]?.stop ?? null;
  const baseLabel = chosen.hasClockTime
    ? formatMinutesAsClock(chosen.startMin)
    : slotDisplayLabel(chosen.stop);

  return {
    isActiveTrip: true,
    dayIndex,
    dayNumber: activeDay.dayNumber,
    totalDays,
    nextStop: chosen.stop,
    followingStop: following,
    scheduledLabel: shiftMinutes > 0 ? `${baseLabel} (+${shiftMinutes}m)` : baseLabel,
  };
}

// ─── 2. "Show Taxi Driver" High-Contrast Address Card ───────────────────────

export interface TaxiDriverCard {
  venueName: string;
  addressLine: string;
  destinationLine: string;
  driverPhrase: string;
  englishSubtitle: string;
  hasExactAddress: boolean;
}

const LOCAL_DRIVER_PHRASES: Array<{ match: RegExp; phrase: string }> = [
  { match: /\b(japan|tokyo|kyoto|osaka)\b/i, phrase: 'ここまでお願いします (Please take me here)' },
  {
    match: /\b(france|paris|chamonix|montreal)\b/i,
    phrase: 'Pouvez-vous m’emmener à cette adresse, s’il vous plaît ?',
  },
  {
    match:
      /\b(spain|barcelona|ibiza|mexico|cancun|argentina|buenos aires|cuba|havana|costa rica)\b/i,
    phrase: 'Por favor, lléveme a esta dirección',
  },
  {
    match: /\b(italy|rome|amalfi|venice|florence)\b/i,
    phrase: 'Per favore, mi porti a questo indirizzo',
  },
  { match: /\b(portugal|lisbon|brazil|rio)\b/i, phrase: 'Por favor, leve-me para este endereço' },
  {
    match: /\b(germany|austria|vienna|switzerland|interlaken)\b/i,
    phrase: 'Bitte bringen Sie mich zu dieser Adresse',
  },
  {
    match: /\b(south korea|seoul)\b/i,
    phrase: '이 주소로 가 주세요 (Please take me to this address)',
  },
  {
    match: /\b(thailand|bangkok|phuket)\b/i,
    phrase: 'กรุณาไปส่งที่อยู่นี้ (Please take me to this address)',
  },
  { match: /\b(vietnam|hanoi)\b/i, phrase: 'Làm ơn đưa tôi đến địa chỉ này' },
  { match: /\b(indonesia|bali)\b/i, phrase: 'Tolong antar saya ke alamat ini' },
  { match: /\b(greece|santorini|athens)\b/i, phrase: 'Παρακαλώ πηγαίνετέ με σε αυτή τη διεύθυνση' },
  { match: /\b(turkey|istanbul)\b/i, phrase: 'Lütfen beni bu adrese götürün' },
  {
    match: /\b(morocco|marrakech|egypt|cairo|uae|dubai|jordan|petra)\b/i,
    phrase: 'من فضلك خذني إلى هذا العنوان (Please take me to this address)',
  },
  {
    match: /\b(netherlands|amsterdam)\b/i,
    phrase: 'Kunt u mij naar dit adres brengen, alstublieft?',
  },
];

export function formatTaxiDriverCard(
  stop: Pick<Activity, 'title' | 'venueAddress' | 'location'>,
  destination: string,
  country?: string
): TaxiDriverCard {
  const venueName = stop.title.trim() || destination;
  const exact = stop.venueAddress?.trim();
  const area = stop.location?.trim();
  const destinationLine = country?.trim() ? `${destination}, ${country}` : destination;
  const addressLine = exact || area || destinationLine;
  const lookupText = `${destination} ${country ?? ''}`;
  const localized = LOCAL_DRIVER_PHRASES.find((entry) => entry.match.test(lookupText));

  return {
    venueName,
    addressLine,
    destinationLine,
    driverPhrase: localized ? localized.phrase : 'Please take me to this address',
    englishSubtitle: exact
      ? 'Show this screen to your driver'
      : 'Area name shown — confirm exact entrance on your map',
    hasExactAddress: Boolean(exact),
  };
}

// ─── 3. "Running Late? Shift +30 / +60 min" Schedule Offset ──────────────────

export interface ShiftedScheduleResult {
  offsetMinutes: number;
  labelsByActivityId: Record<string, string>;
  bannerText: string | null;
}

export function shiftDaySchedule(
  day: TripDay | undefined,
  offsetMinutes: number
): ShiftedScheduleResult {
  const normalizedOffset =
    Number.isFinite(offsetMinutes) && offsetMinutes > 0
      ? Math.min(240, Math.round(offsetMinutes))
      : 0;

  if (!day || normalizedOffset === 0) {
    return { offsetMinutes: 0, labelsByActivityId: {}, bannerText: null };
  }

  const labelsByActivityId: Record<string, string> = {};
  day.activities.forEach((activity, index) => {
    const resolved = resolveActivityTiming(day, activity, index, normalizedOffset);
    labelsByActivityId[activity.id] = resolved.hasClockTime
      ? formatMinutesAsClock(resolved.startMin)
      : `${slotDisplayLabel(activity)} (+${normalizedOffset}m)`;
  });

  return {
    offsetMinutes: normalizedOffset,
    labelsByActivityId,
    bannerText: `Schedule shifted +${normalizedOffset} min for today. Check venue closing times.`,
  };
}

// ─── 4. 1-Tap Apple / Google Maps Multi-Stop Day Route URLs ─────────────────

function stopQueryLabel(stop: Activity, destination?: string, country?: string): string {
  const base = stop.venueAddress?.trim()
    ? `${stop.title}, ${stop.venueAddress.trim()}`
    : stop.location?.trim() && stop.location.toLowerCase() !== stop.title.toLowerCase()
      ? `${stop.title}, ${stop.location.trim()}`
      : stop.title;

  const suffix = [destination?.trim(), country?.trim()].filter(Boolean).join(', ');
  if (!suffix) return base;
  if (destination && base.toLowerCase().includes(destination.toLowerCase())) {
    return base;
  }
  return `${base}, ${suffix}`;
}

export function buildGoogleMapsDayRouteUrl(
  day: TripDay | undefined,
  destination?: string,
  country?: string
): string | null {
  if (!day || !Array.isArray(day.activities) || day.activities.length === 0) return null;
  const stops = day.activities
    .filter((a) => a.title && a.title.trim().length > 0 && a.planningIdea !== true)
    .slice(0, 10);

  if (stops.length === 0) return null;

  if (stops.length === 1) {
    const query = encodeURIComponent(stopQueryLabel(stops[0], destination, country));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  const origin = encodeURIComponent(stopQueryLabel(stops[0], destination, country));
  const dest = encodeURIComponent(stopQueryLabel(stops[stops.length - 1], destination, country));
  const waypoints = stops
    .slice(1, -1)
    .slice(0, 8)
    .map((s) => encodeURIComponent(stopQueryLabel(s, destination, country)))
    .join('%7C');

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${
    waypoints ? `&waypoints=${waypoints}` : ''
  }&travelmode=walking`;
}

export function buildAppleMapsDayRouteUrl(
  day: TripDay | undefined,
  destination?: string,
  country?: string
): string | null {
  if (!day || !Array.isArray(day.activities) || day.activities.length === 0) return null;
  const stops = day.activities
    .filter((a) => a.title && a.title.trim().length > 0 && a.planningIdea !== true)
    .slice(0, 10);

  if (stops.length === 0) return null;

  if (stops.length === 1) {
    const q = encodeURIComponent(stopQueryLabel(stops[0], destination, country));
    return `https://maps.apple.com/?q=${q}`;
  }

  const saddr = encodeURIComponent(stopQueryLabel(stops[0], destination, country));
  const daddr = stops
    .slice(1)
    .map((s) => encodeURIComponent(stopQueryLabel(s, destination, country)))
    .join('+to:');

  return `https://maps.apple.com/?saddr=${saddr}&daddr=${daddr}&dirflg=w`;
}

export function buildStopDirectionsUrl(
  stop: Activity,
  destination: string,
  country?: string,
  platform: 'ios' | 'android' | 'web' = 'ios'
): string {
  const query = encodeURIComponent(stopQueryLabel(stop, destination, country));
  if (platform === 'ios') {
    return `https://maps.apple.com/?daddr=${query}&dirflg=w`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=walking`;
}

export function summarizeDayRoute(day: TripDay | undefined): {
  stopCount: number;
  areas: string[];
  label: string | null;
} {
  if (!day || !Array.isArray(day.activities) || day.activities.length === 0) {
    return { stopCount: 0, areas: [], label: null };
  }
  const stops = day.activities.filter((a) => a.title?.trim());
  const areas = Array.from(
    new Set(
      stops
        .map((a) => a.location?.trim())
        .filter((loc): loc is string => Boolean(loc && loc.length >= 2 && loc.length <= 40))
    )
  ).slice(0, 3);

  const areaPrefix = areas.length > 0 ? `${areas.slice(0, 2).join(' · ')} · ` : '';
  return {
    stopCount: stops.length,
    areas,
    label: `${areaPrefix}${stops.length} stop${stops.length === 1 ? '' : 's'}`,
  };
}

// ─── 5. "Why We Picked This" Grounded Stop Rationale Badges ─────────────────

const VIBE_MATCH_KEYWORDS: Record<string, RegExp> = {
  foodie:
    /\b(restaurant|cafe|bistro|ramen|sushi|market|bakery|tapas|trattoria|dining|food|wine|bar|tea|coffee|street food)\b/i,
  culture:
    /\b(museum|temple|shrine|cathedral|gallery|palace|historic|castle|monument|old town|architecture|theater|heritage)\b/i,
  relaxation:
    /\b(beach|garden|park|lounge|promenade|spa|coastal|sunset|plaza|terrace|cruise|lake)\b/i,
  adventure:
    /\b(hike|trail|kayak|climb|viewpoint|summit|cable car|surf|bike|tour|canyon|glacier)\b/i,
  nature: /\b(park|garden|mountain|lake|waterfall|forest|river|island|botanical|reserve|cliff)\b/i,
  romantic: /\b(sunset|river|viewpoint|terrace|bistro|garden|bridge|caldera|rooftop|canal)\b/i,
  nightlife: /\b(bar|cocktail|pub|jazz|rooftop|club|music|night market|brewery)\b/i,
  wellness: /\b(spa|onsen|thermal|bath|yoga|garden|tea house|botanical|hot spring)\b/i,
  family: /\b(park|aquarium|zoo|museum|science|ferry|plaza|garden|market)\b/i,
  luxury: /\b(fine dining|michelin|rooftop|palace|boutique|private|champagne|gallery)\b/i,
  budget: /\b(free|market|park|walk|stroll|plaza|street food|viewpoint)\b/i,
  solo: /\b(museum|cafe|market|neighborhood|bookstore|gallery|walk|ramen)\b/i,
};

const VIBE_LABEL_BY_ID = new Map(travelVibes.map((v) => [v.id, v.label]));

/**
 * Computes 1–2 strictly factual rationale pills for an activity.
 * Never invents allergen-safety, accessibility verification, or booking guarantees.
 */
export function explainMobileStop(
  activity: Activity,
  context: {
    vibes?: string[];
    requirements?: TravelerRequirements | null;
    previousActivity?: Activity;
  }
): string[] {
  const reasons: string[] = [];
  if (activity.planningIdea) {
    return ['Planning idea — verify venue'];
  }

  const haystack = `${activity.title} ${activity.description} ${activity.type}`.toLowerCase();

  // 1. Vibe match based strictly on user's selected vibes & stop metadata
  for (const vibeId of context.vibes ?? []) {
    const matcher = VIBE_MATCH_KEYWORDS[vibeId];
    if (
      matcher &&
      (matcher.test(haystack) || (vibeId === 'foodie' && activity.type === 'restaurant'))
    ) {
      const label = VIBE_LABEL_BY_ID.get(vibeId) ?? vibeId;
      reasons.push(`Matches your ${label} vibe`);
      break;
    }
  }

  // 2. Same neighborhood/area continuity with previous stop
  if (
    reasons.length < 2 &&
    context.previousActivity?.location &&
    activity.location &&
    context.previousActivity.location.trim().toLowerCase() ===
      activity.location.trim().toLowerCase()
  ) {
    reasons.push(`Near ${context.previousActivity.title}`);
  }

  // 3. Verified rating fact (only when rating is genuinely present on the record)
  if (reasons.length < 2 && typeof activity.rating === 'number' && activity.rating >= 4.5) {
    reasons.push(`Highly rated (${activity.rating.toFixed(1)}★)`);
  }

  // 4. Free cancellation fact (only when explicitly true on a bookable stop)
  if (reasons.length < 2 && activity.bookingUrl && activity.freeCancellation === true) {
    reasons.push('Free cancellation noted');
  }

  // 5. Fallback to factual slot/duration note if nothing else matched
  if (reasons.length === 0 && activity.location?.trim()) {
    reasons.push(`In ${activity.location.trim()}`);
  }

  return reasons.slice(0, 2);
}

// ─── 6. Proactive Booking Readiness Lead-Time Radar ─────────────────────────

export interface BookingReadinessFlag {
  dayNumber: number;
  title: string;
  reason: string;
  id?: string;
  activityType?: string;
  bookingUrl?: string;
  affiliatePartner?: string;
  price?: string;
}

export interface BookingReadinessSummary {
  daysUntilTrip: number | null;
  urgency: 'now' | 'soon' | 'relaxed' | 'active' | 'past';
  headline: string;
  detail: string;
  flaggedStops: BookingReadinessFlag[];
}

const TIMED_ENTRY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(museum|gallery|louvre|uffizi|vatican|teamlab|ghibli|anne frank|sagrada|alhambra|colosseum)\b/i,
    reason: 'Timed-entry tickets often sell out ahead',
  },
  {
    pattern:
      /\b(observation deck|tower|skydeck|skytree|shibuya sky|burj|eiffel|summit|cable car)\b/i,
    reason: 'Peak sunset slots fill quickly',
  },
  {
    pattern: /\b(cruise|boat tour|ferry|gondola|excursion|day trip|guided tour)\b/i,
    reason: 'Limited departure capacity',
  },
  {
    pattern: /\b(michelin|omakase|tasting menu|fine dining|rooftop)\b/i,
    reason: 'Advance table reservations recommended',
  },
];

export function computeBookingReadiness(
  trip: Trip,
  now: Date = new Date()
): BookingReadinessSummary {
  const todayStr = localCalendarDate(now);
  const phase = tripDatePhase(trip.startDate, trip.endDate, todayStr);
  const start = parseTripDate(trip.startDate);
  const today = parseTripDate(todayStr);

  const daysUntilTrip =
    !Number.isNaN(start.getTime()) && !Number.isNaN(today.getTime())
      ? Math.round((start.getTime() - today.getTime()) / 86_400_000)
      : null;

  const flaggedStops: BookingReadinessFlag[] = [];
  const seenTitles = new Set<string>();

  for (const day of trip.days) {
    for (const activity of day.activities) {
      if (activity.planningIdea) continue;
      const key = activity.title.trim().toLowerCase();
      if (!key || seenTitles.has(key)) continue;

      const text = `${activity.title} ${activity.description}`;
      const matched = TIMED_ENTRY_PATTERNS.find((entry) => entry.pattern.test(text));
      if (matched) {
        seenTitles.add(key);
        flaggedStops.push({
          dayNumber: day.dayNumber,
          title: activity.title,
          reason: matched.reason,
          id: activity.id,
          activityType: activity.type,
          bookingUrl: activity.bookingUrl,
          affiliatePartner: activity.affiliatePartner,
          price: activity.price,
        });
      } else if (activity.bookingUrl) {
        seenTitles.add(key);
        flaggedStops.push({
          dayNumber: day.dayNumber,
          title: activity.title,
          reason:
            activity.type === 'restaurant'
              ? 'Check reservation availability directly'
              : 'Review ticket options with the provider',
          id: activity.id,
          activityType: activity.type,
          bookingUrl: activity.bookingUrl,
          affiliatePartner: activity.affiliatePartner,
          price: activity.price,
        });
      }
    }
  }

  if (phase === 'past') {
    return {
      daysUntilTrip,
      urgency: 'past',
      headline: 'Trip completed',
      detail: 'Your saved plan remains available for reference.',
      flaggedStops: flaggedStops.slice(0, 5),
    };
  }

  if (phase === 'in-progress') {
    return {
      daysUntilTrip: 0,
      urgency: 'active',
      headline: 'On your trip today',
      detail:
        flaggedStops.length > 0
          ? `${flaggedStops.length} stop${flaggedStops.length === 1 ? '' : 's'} may need timed tickets or reservations — check directly before heading over.`
          : 'Confirm opening hours directly with venues before heading out.',
      flaggedStops: flaggedStops.slice(0, 5),
    };
  }

  const count = flaggedStops.length;
  const daysPrefix =
    daysUntilTrip !== null && daysUntilTrip > 0
      ? `${daysUntilTrip} day${daysUntilTrip === 1 ? '' : 's'} out`
      : 'Upcoming trip';

  if (count === 0) {
    return {
      daysUntilTrip,
      urgency: 'relaxed',
      headline: `${daysPrefix} · Flexible schedule`,
      detail: 'No high-demand timed tickets detected yet. Confirm venue hours closer to departure.',
      flaggedStops: [],
    };
  }

  if (daysUntilTrip !== null && daysUntilTrip <= 14) {
    return {
      daysUntilTrip,
      urgency: 'now',
      headline: `${daysPrefix} · ${count} stop${count === 1 ? '' : 's'} worth checking now`,
      detail:
        'Popular timed-entry venues and restaurants can fill up within two weeks. Availability is not verified — check directly with providers.',
      flaggedStops: flaggedStops.slice(0, 5),
    };
  }

  if (daysUntilTrip !== null && daysUntilTrip <= 45) {
    return {
      daysUntilTrip,
      urgency: 'soon',
      headline: `${daysPrefix} · ${count} stop${count === 1 ? '' : 's'} to reserve ahead`,
      detail:
        'Good window to check timed-entry tickets and hotel cancellation terms directly with providers.',
      flaggedStops: flaggedStops.slice(0, 5),
    };
  }

  return {
    daysUntilTrip,
    urgency: 'relaxed',
    headline: `${daysPrefix} · ${count} advance-booking stop${count === 1 ? '' : 's'} spotted`,
    detail: 'Plenty of lead time. Bookmark top picks and verify opening windows closer to travel.',
    flaggedStops: flaggedStops.slice(0, 5),
  };
}

// ─── 7. Grounded Co-Pilot Remix (API + Strictly Grounded Local Fallback) ─────

export type CopilotActionType =
  | 'swap_stop'
  | 'relax_day'
  | 'rain_backup'
  | 'shift_day'
  | 'natural_language'
  | 'undo';

export interface CopilotDiffItem {
  dayNumber: number;
  slot: string;
  before?: string;
  after?: string;
  action: 'swapped' | 'removed' | 'moved';
}

export interface CopilotRemixResult {
  applied: boolean;
  summary: string;
  diff: CopilotDiffItem[];
  updatedDays?: TripDay[];
  previousDays?: TripDay[];
  notice?: string;
  source: 'api' | 'local';
}

const OUTDOOR_STOP_PATTERN =
  /\b(park|garden|beach|hike|trail|walk|walking tour|viewpoint|lookout|plaza|promenade|outdoor|market|ferry|boat|cruise|bridge|waterfront|cliff|lake)\b/i;

export function findOutdoorStopsOnDay(day: TripDay | undefined): Activity[] {
  if (!day) return [];
  return day.activities.filter(
    (a) => a.type !== 'restaurant' && OUTDOOR_STOP_PATTERN.test(`${a.title} ${a.description}`)
  );
}

/**
 * Strictly grounded local fallback for offline / local trips.
 * NEVER invents or fabricates new venues. Only trims optional stops (`relax_day`)
 * or shifts morning stops to afternoon (`shift_day`). For venue swaps or indoor
 * replacements without a server backup pool, returns an honest notice.
 */
export function applyLocalTripRemix(
  days: TripDay[],
  request: {
    action: CopilotActionType;
    dayNumber: number;
    stopName?: string;
    instruction?: string;
  }
): CopilotRemixResult {
  const dayIndex = days.findIndex((d) => d.dayNumber === request.dayNumber);
  if (dayIndex === -1) {
    return {
      applied: false,
      summary: `Day ${request.dayNumber} was not found in this itinerary.`,
      diff: [],
      source: 'local',
    };
  }

  const targetDay = days[dayIndex];
  const previousDays = days.map((d) => ({
    ...d,
    activities: d.activities.map((a) => ({ ...a })),
  }));

  if (request.action === 'relax_day') {
    const removable = targetDay.activities.filter(
      (a) => a.type !== 'restaurant' && a.type !== 'accommodation' && a.type !== 'transport'
    );
    if (removable.length <= 1) {
      return {
        applied: false,
        summary: `Day ${request.dayNumber} already has a relaxed pace.`,
        diff: [],
        notice: 'At least one main stop is kept so the day stays structured.',
        source: 'local',
      };
    }

    // Drop the last optional non-meal activity (or lowest-rated non-bookable stop)
    const candidate =
      [...removable].reverse().find((a) => !a.bookingUrl) ?? removable[removable.length - 1];
    const nextActivities = targetDay.activities.filter((a) => a.id !== candidate.id);
    const updatedDays = days.map((d, idx) =>
      idx === dayIndex
        ? {
            ...d,
            activities: nextActivities,
            timingProposal: undefined, // clear stale timing proposal so nothing shows outdated clocks
          }
        : d
    );

    return {
      applied: true,
      summary: `Removed ${candidate.title} to give Day ${request.dayNumber} more breathing room.`,
      diff: [
        {
          dayNumber: request.dayNumber,
          slot: candidate.scheduleSlot ?? candidate.time ?? 'day',
          before: candidate.title,
          action: 'removed',
        },
      ],
      updatedDays,
      previousDays,
      source: 'local',
    };
  }

  if (request.action === 'shift_day') {
    const morningStop = targetDay.activities.find(
      (a) => a.scheduleSlot === 'morning' && a.type !== 'restaurant'
    );
    if (!morningStop) {
      return {
        applied: false,
        summary: `Day ${request.dayNumber} has no morning activity to shift.`,
        diff: [],
        source: 'local',
      };
    }

    const shiftedStop = {
      ...morningStop,
      scheduleSlot: 'afternoon' as const,
      time: 'afternoon',
    };
    const remaining = targetDay.activities.filter((a) => a.id !== morningStop.id);
    const firstEveningIndex = remaining.findIndex((a) => a.scheduleSlot === 'evening');
    const updatedActivities =
      firstEveningIndex === -1
        ? [...remaining, shiftedStop]
        : [
            ...remaining.slice(0, firstEveningIndex),
            shiftedStop,
            ...remaining.slice(firstEveningIndex),
          ];
    const updatedDays = days.map((d, idx) =>
      idx === dayIndex
        ? {
            ...d,
            activities: updatedActivities,
            timingProposal: undefined,
          }
        : d
    );

    return {
      applied: true,
      summary: `Moved ${morningStop.title} to the afternoon for a slower morning on Day ${request.dayNumber}.`,
      diff: [
        {
          dayNumber: request.dayNumber,
          slot: 'morning → afternoon',
          before: morningStop.title,
          after: morningStop.title,
          action: 'moved',
        },
      ],
      updatedDays,
      previousDays,
      source: 'local',
    };
  }

  if (request.action === 'rain_backup') {
    const outdoor = findOutdoorStopsOnDay(targetDay);
    return {
      applied: false,
      summary:
        outdoor.length > 0
          ? `Found ${outdoor.length} outdoor stop${outdoor.length === 1 ? '' : 's'} on Day ${request.dayNumber} (${outdoor
              .map((s) => s.title)
              .slice(0, 2)
              .join(', ')}).`
          : `No outdoor stops were flagged on Day ${request.dayNumber}.`,
      diff: [],
      notice:
        'Connect online to swap outdoor stops with grounded indoor backups from Faroway’s venue search.',
      source: 'local',
    };
  }

  return {
    applied: false,
    summary: 'Swapping venues requires a live connection to Faroway’s verified venue pool.',
    diff: [],
    notice: 'Reconnect and try again, or use "Make day more relaxed" while offline.',
    source: 'local',
  };
}

/**
 * Calls POST /api/trips/${tripId}/copilot with auth headers, transforming any
 * returned itinerary into mobile TripDay[] format, or falls back safely for
 * offline/local trips without fabricating venues.
 */
export async function runTripCopilotAction(params: {
  tripId: string;
  days: TripDay[];
  action: CopilotActionType;
  dayNumber: number;
  slot?: 'morning' | 'afternoon' | 'evening';
  targetDayNumber?: number;
  targetSlot?: 'morning' | 'afternoon' | 'evening';
  stopName?: string;
  instruction?: string;
  expectedUpdatedAt?: string;
  undoRevisionId?: string;
  signal?: AbortSignal;
}): Promise<CopilotRemixResult & { undoRevisionId?: string | null; updatedAt?: string }> {
  const {
    tripId,
    days,
    action,
    dayNumber,
    slot,
    targetDayNumber,
    targetSlot,
    stopName,
    instruction,
    expectedUpdatedAt,
    undoRevisionId,
    signal,
  } = params;

  if (tripId.startsWith('local_')) {
    return applyLocalTripRemix(days, { action, dayNumber, stopName, instruction });
  }

  try {
    const [{ API_BASE_URL }, { getAuthHeaders }, { requestWithTimeout }] = await Promise.all([
      import('../constants/api'),
      import('./supabase'),
      import('../services/request'),
    ]);
    const headers = await getAuthHeaders();
    if (signal?.aborted) {
      return { applied: false, summary: 'Cancelled', diff: [], source: 'api' };
    }

    const resolvedSlot = slot ?? (action === 'shift_day' ? 'morning' : undefined);
    const instructionMentionsDay = Boolean(instruction && /\bday\s+\d+\b/i.test(instruction));
    const includeDayNumber = !(action === 'natural_language' && instructionMentionsDay);

    const payload: Record<string, unknown> = {
      ...(action !== 'natural_language' ? { action } : {}),
      ...(includeDayNumber ? { dayNumber } : {}),
      ...(resolvedSlot ? { slot: resolvedSlot } : {}),
      ...(targetDayNumber !== undefined ? { targetDayNumber } : {}),
      ...(targetSlot ? { targetSlot } : {}),
      ...(stopName ? { stopName } : {}),
      ...(instruction ? { prompt: instruction } : {}),
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
      ...(undoRevisionId ? { undoRevisionId } : {}),
    };

    const data = await requestWithTimeout(
      `${API_BASE_URL}/api/trips/${encodeURIComponent(tripId)}/copilot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
        signal,
      },
      async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            body &&
            typeof body === 'object' &&
            typeof (body as { error?: unknown }).error === 'string'
              ? (body as { error: string }).error
              : `Request failed (HTTP ${response.status})`;
          throw new Error(message);
        }
        return body;
      },
      12_000
    );

    if (!data || typeof data !== 'object') {
      return {
        applied: false,
        summary: 'Could not read co-pilot response.',
        diff: [],
        notice: 'Your saved itinerary is unchanged. Please try again.',
        source: 'api',
      };
    }

    const record = data as Record<string, unknown>;
    const updatedRaw = record.updatedItinerary as { days?: unknown[] } | undefined;
    const updatedDays =
      updatedRaw && Array.isArray(updatedRaw.days)
        ? transformItineraryDays(updatedRaw.days)
        : undefined;

    const diff = Array.isArray(record.diff) ? (record.diff as CopilotDiffItem[]) : [];

    return {
      applied: record.applied === true,
      summary:
        typeof record.summary === 'string' && record.summary.trim()
          ? record.summary.trim()
          : record.applied
            ? 'Itinerary updated.'
            : 'No changes were made.',
      diff,
      updatedDays: updatedDays && updatedDays.length > 0 ? updatedDays : undefined,
      previousDays: days.map((d) => ({ ...d, activities: d.activities.map((a) => ({ ...a })) })),
      notice: typeof record.notice === 'string' ? record.notice : undefined,
      undoRevisionId: typeof record.undoRevisionId === 'string' ? record.undoRevisionId : null,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
      source: 'api',
    };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw error;
    }
    // For remote saved trips, never silently diverge from server state on network/auth/conflict errors.
    return {
      applied: false,
      summary: 'Could not save this edit right now.',
      diff: [],
      notice:
        error instanceof Error
          ? error.message
          : 'Check your connection and try again. Your saved trip is unchanged.',
      source: 'api',
    };
  }
}
