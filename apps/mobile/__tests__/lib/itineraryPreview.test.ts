import { buildSeededItineraryOutline } from '../../lib/itineraryPreview';

describe('seeded itinerary outline', () => {
  it('builds immediate destination-specific generation context from trip input', () => {
    const outline = buildSeededItineraryOutline({
      destination: 'Tokyo',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      travelers: 2,
      travelerType: 'couple',
      vibes: ['foodie', 'hidden-gems', 'nightlife'],
      budget: 'moderate',
    });

    expect(outline).toEqual({
      title: 'Tokyo outline',
      dateLabel: 'Jun 1 - Jun 5 - 4 nights',
      travelersLabel: '2 travelers',
      budgetLabel: 'Moderate budget',
      styleLabel: 'Couple',
      focusAreas: ['Foodie', 'Hidden Gems', 'Nightlife'],
      planningAreas: ['Hotels', 'Activities', 'Dining', 'Transport', 'Budget'],
    });
  });

  it('uses practical defaults when optional style inputs are missing', () => {
    const outline = buildSeededItineraryOutline({
      destination: 'Paris',
      startDate: 'not-a-date',
      endDate: 'also-not-a-date',
      travelers: 1,
      travelerType: '',
      vibes: [],
    });

    expect(outline).toMatchObject({
      title: 'Paris outline',
      dateLabel: 'Dates selected',
      travelersLabel: '1 traveler',
      budgetLabel: 'Flexible budget',
      styleLabel: 'Personalized trip',
      focusAreas: ['Balanced pace', 'Local highlights', 'Booking context'],
    });
  });
});
