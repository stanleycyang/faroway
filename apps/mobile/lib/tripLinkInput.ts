import { travelerTypes, travelVibes } from '@faroway/constants';
import type { TripInput } from '../stores/tripStore';

export function tripInputFromLink(params: Record<string, unknown>): Partial<TripInput> | null {
  const text = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined;
  const destination = text('destination')?.trim();
  if (!destination) return null;
  const result: Partial<TripInput> = { destination };
  for (const key of ['country', 'placeId', 'startDate', 'endDate'] as const) {
    const value = text(key);
    if (value !== undefined) result[key] = value;
  }
  const vibes = text('vibes');
  if (vibes !== undefined)
    result.vibes = [...new Set(vibes.split(',').map((value) => value.trim()))]
      .filter((value) => travelVibes.some((choice) => choice.id === value))
      .slice(0, 5);
  const type = text('travelerType');
  if (type && travelerTypes.some((choice) => choice.id === type)) result.travelerType = type;
  const count = Number(text('travelers'));
  if (Number.isInteger(count) && count >= 1 && count <= 10) result.travelers = count;
  return result;
}
