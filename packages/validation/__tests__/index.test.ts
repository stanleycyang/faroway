import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  dateSchema,
  registerSchema,
  loginSchema,
  tripStatusSchema,
  budgetLevelSchema,
  travelerTypeSchema,
  createTripSchema,
  updateTripSchema,
  activitySchema,
  createItinerarySchema,
  updateItinerarySchema,
  travelStyleSchema,
  updatePreferencesSchema,
  paginationSchema,
  tripQuerySchema,
  searchInputSchema,
  trackClickSchema,
} from '../src/index';

describe('uuidSchema', () => {
  it('accepts valid UUID', () => {
    const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = uuidSchema.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('accepts valid email and lowercases it', () => {
    const result = emailSchema.safeParse('User@Example.COM');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('user@example.com');
    }
  });

  it('rejects invalid email', () => {
    expect(emailSchema.safeParse('not-email').success).toBe(false);
  });

  it('rejects email with spaces', () => {
    expect(emailSchema.safeParse('  user@example.com  ').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts valid password', () => {
    expect(passwordSchema.safeParse('MyPassword1').success).toBe(true);
  });

  it('rejects short password', () => {
    expect(passwordSchema.safeParse('Ab1').success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    expect(passwordSchema.safeParse('alllower1').success).toBe(false);
  });

  it('rejects password without number', () => {
    expect(passwordSchema.safeParse('AllLettersNoNum').success).toBe(false);
  });

  it('rejects password without lowercase', () => {
    expect(passwordSchema.safeParse('ALLUPPER1').success).toBe(false);
  });

  it('rejects password over 100 characters', () => {
    expect(passwordSchema.safeParse('Aa1' + 'a'.repeat(98)).success).toBe(false);
  });
});

describe('dateSchema', () => {
  it('accepts valid date string', () => {
    expect(dateSchema.safeParse('2026-06-01').success).toBe(true);
  });

  it('rejects invalid date string', () => {
    expect(dateSchema.safeParse('not-a-date').success).toBe(false);
  });
});

describe('tripStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const statuses = ['draft', 'planning', 'planned', 'booked', 'active', 'in_progress', 'completed', 'cancelled'];
    for (const status of statuses) {
      expect(tripStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(tripStatusSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('budgetLevelSchema', () => {
  it('accepts all valid levels', () => {
    expect(budgetLevelSchema.safeParse('budget').success).toBe(true);
    expect(budgetLevelSchema.safeParse('moderate').success).toBe(true);
    expect(budgetLevelSchema.safeParse('luxury').success).toBe(true);
  });

  it('rejects invalid level', () => {
    expect(budgetLevelSchema.safeParse('extreme').success).toBe(false);
  });
});

describe('travelerTypeSchema', () => {
  it('accepts all valid types', () => {
    const types = ['solo', 'couple', 'family', 'friends', 'business'];
    for (const type of types) {
      expect(travelerTypeSchema.safeParse(type).success).toBe(true);
    }
  });
});

describe('createTripSchema', () => {
  const valid = {
    destination: 'Tokyo',
    start_date: '2026-04-01',
    end_date: '2026-04-07',
  };

  it('accepts valid input with defaults', () => {
    const result = createTripSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
    }
  });

  it('rejects empty destination', () => {
    expect(createTripSchema.safeParse({ ...valid, destination: '' }).success).toBe(false);
  });

  it('rejects end_date before start_date', () => {
    expect(
      createTripSchema.safeParse({ ...valid, start_date: '2026-04-07', end_date: '2026-04-01' }).success,
    ).toBe(false);
  });

  it('accepts same start and end date', () => {
    expect(
      createTripSchema.safeParse({ ...valid, start_date: '2026-04-01', end_date: '2026-04-01' }).success,
    ).toBe(true);
  });

  it('accepts negative budget', () => {
    expect(createTripSchema.safeParse({ ...valid, budget: -100 }).success).toBe(false);
  });
});

describe('updateTripSchema', () => {
  it('accepts empty object', () => {
    expect(updateTripSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update', () => {
    const result = updateTripSchema.safeParse({ destination: 'Osaka' });
    expect(result.success).toBe(true);
  });

  it('passes when only one date provided', () => {
    expect(updateTripSchema.safeParse({ start_date: '2026-06-01' }).success).toBe(true);
  });
});

describe('activitySchema', () => {
  it('accepts valid activity', () => {
    expect(
      activitySchema.safeParse({
        time: '09:30',
        title: 'Visit Museum',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid time format', () => {
    expect(
      activitySchema.safeParse({ time: '9:30am', title: 'Visit' }).success,
    ).toBe(false);
  });
});

describe('createItinerarySchema', () => {
  it('accepts valid itinerary', () => {
    const result = createItinerarySchema.safeParse({
      trip_id: '550e8400-e29b-41d4-a716-446655440000',
      day_number: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activities).toEqual([]);
    }
  });

  it('rejects non-positive day number', () => {
    expect(
      createItinerarySchema.safeParse({
        trip_id: '550e8400-e29b-41d4-a716-446655440000',
        day_number: 0,
      }).success,
    ).toBe(false);
  });
});

describe('updateItinerarySchema', () => {
  it('accepts valid update', () => {
    expect(updateItinerarySchema.safeParse({ notes: 'Updated notes' }).success).toBe(true);
  });

  it('accepts null notes', () => {
    expect(updateItinerarySchema.safeParse({ notes: null }).success).toBe(true);
  });
});

describe('travelStyleSchema', () => {
  it('accepts all valid styles', () => {
    const styles = ['budget', 'mid_range', 'luxury', 'backpacker', 'business'];
    for (const style of styles) {
      expect(travelStyleSchema.safeParse(style).success).toBe(true);
    }
  });
});

describe('updatePreferencesSchema', () => {
  it('accepts valid preferences', () => {
    const result = updatePreferencesSchema.safeParse({
      interests: ['hiking', 'food'],
      travel_style: 'luxury',
      dietary_restrictions: ['vegetarian'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts null travel_style', () => {
    expect(updatePreferencesSchema.safeParse({ travel_style: null }).success).toBe(true);
  });

  it('rejects too many interests (> 50)', () => {
    const interests = Array.from({ length: 51 }, (_, i) => `interest-${i}`);
    expect(updatePreferencesSchema.safeParse({ interests }).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('defaults to page 1 and limit 10', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
    }
  });

  it('coerces strings', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '25' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(25);
    }
  });
});

describe('tripQuerySchema', () => {
  it('extends pagination with optional status and destination', () => {
    const result = tripQuerySchema.safeParse({ status: 'draft', destination: 'Tokyo' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
      expect(result.data.destination).toBe('Tokyo');
      expect(result.data.page).toBe(1);
    }
  });
});

describe('searchInputSchema', () => {
  const valid = {
    destination: 'Barcelona',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    travelers: 2,
  };

  it('accepts valid input with defaults', () => {
    const result = searchInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vibes).toEqual([]);
    }
  });

  it('rejects too many travelers', () => {
    expect(searchInputSchema.safeParse({ ...valid, travelers: 21 }).success).toBe(false);
  });
});

describe('trackClickSchema', () => {
  const valid = {
    itemType: 'hotel' as const,
    itemId: 'htl-1',
    itemName: 'Grand Hotel',
    affiliatePartner: 'booking.com',
    affiliateUrl: 'https://booking.com/htl-1',
  };

  it('accepts valid click', () => {
    expect(trackClickSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid URL', () => {
    expect(trackClickSchema.safeParse({ ...valid, affiliateUrl: 'not-url' }).success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = trackClickSchema.safeParse({
      ...valid,
      searchId: 's-1',
      tripId: 't-1',
      price: 100,
      currency: 'USD',
      source: 'search_results',
    });
    expect(result.success).toBe(true);
  });
});
