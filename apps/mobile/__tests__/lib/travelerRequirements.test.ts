import { travelerRequirementLines } from '../../lib/travelerRequirements';

it('preserves all saved needs with readable labels and no suitability claims', () => {
  expect(
    travelerRequirementLines({
      allergies: ['Peanuts', 'Sesame'],
      dietaryPreferences: ['Vegan'],
      accessibility: ['step_free_entrance', 'accessible_restroom'],
      mobilityNotes: 'Rest every 30 minutes',
    })
  ).toEqual([
    'Food allergies: Peanuts, Sesame',
    'Dietary preferences: Vegan',
    'Access needs: Step-free entrance, Accessible restroom',
    'Mobility and rest: Rest every 30 minutes',
  ]);
  expect(travelerRequirementLines(null)).toEqual([]);
  expect(
    travelerRequirementLines({
      allergies: [],
      dietaryPreferences: [],
      accessibility: [],
      mobilityNotes: ' ',
    })
  ).toEqual([]);
});
