import type { Trip } from '../stores/tripStore';

/**
 * Map backend trip statuses (which include generation lifecycle states like
 * 'generated' and 'failed') onto the narrower mobile UI status enum used by
 * Trip['status']. Sync path AND useTrips share this helper so a trip's
 * status doesn't depend on which code path fetched it — the profile-screen
 * counters and dashboard filters can rely on a closed set of values.
 */
export function normalizeTripStatus(apiStatus: string | undefined): Trip['status'] {
  switch (apiStatus) {
    case 'draft':
    case 'pending':
    case 'generating':
      return 'draft';
    case 'generated':
    case 'planned':
    case 'failed':
      return 'planned';
    case 'active':
      return 'active';
    case 'completed':
      return 'completed';
    default:
      return 'planned';
  }
}
