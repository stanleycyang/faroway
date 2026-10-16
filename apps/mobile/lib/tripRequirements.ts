import { parseTripDate } from './tripDate';
export function getMissingTripRequirements(
  input?: {
    destination?: string;
    startDate?: string;
    endDate?: string;
  } | null
): Array<'destination' | 'dates'> {
  const missing: Array<'destination' | 'dates'> = [];
  if (!input?.destination?.trim()) missing.push('destination');
  const start = parseTripDate(input?.startDate || '');
  const end = parseTripDate(input?.endDate || '');
  if (
    !input?.startDate ||
    !input?.endDate ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  )
    missing.push('dates');
  return missing;
}

export function formatMissingTripRequirements(missing: Array<'destination' | 'dates'>): string {
  if (missing.length === 0) return '';
  if (missing.includes('destination') && missing.includes('dates')) {
    return 'Add a destination and dates to generate';
  }
  if (missing.includes('destination')) return 'Add a destination to generate';
  return 'Add travel dates to generate';
}
