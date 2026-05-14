import type { TripInput } from '../stores/tripStore';

export interface SeededItineraryOutline {
  title: string;
  dateLabel: string;
  travelersLabel: string;
  budgetLabel: string;
  styleLabel: string;
  focusAreas: string[];
  planningAreas: string[];
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string): string | null {
  const date = parseDateOnly(value);
  if (!date) return null;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (!start || !end) return 'Dates selected';

  const startValue = parseDateOnly(startDate);
  const endValue = parseDateOnly(endDate);
  const nights =
    startValue && endValue
      ? Math.max(0, Math.round((endValue.getTime() - startValue.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
  const duration = nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '1 day';

  return `${start} - ${end} - ${duration}`;
}

function toTitle(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function buildSeededItineraryOutline(
  input?: TripInput | null
): SeededItineraryOutline | null {
  if (!input?.destination) return null;

  const vibes = Array.isArray(input.vibes) ? input.vibes : [];
  const travelers = Math.max(1, input.travelers || 1);
  const focusAreas =
    vibes.length > 0
      ? vibes.slice(0, 3).map(toTitle)
      : ['Balanced pace', 'Local highlights', 'Booking context'];

  return {
    title: `${input.destination} outline`,
    dateLabel: formatDateRange(input.startDate, input.endDate),
    travelersLabel: `${travelers} traveler${travelers === 1 ? '' : 's'}`,
    budgetLabel: input.budget ? `${toTitle(input.budget)} budget` : 'Flexible budget',
    styleLabel: input.travelerType ? toTitle(input.travelerType) : 'Personalized trip',
    focusAreas,
    planningAreas: ['Hotels', 'Activities', 'Dining', 'Transport', 'Budget'],
  };
}
