import { validatePreviewBlocks } from '../../lib/json-render/validate-preview';

it('retains a valid story block while rejecting malformed cards that would crash the renderer', () => {
  const result = validatePreviewBlocks([
    { type: 'Text', props: { content: 'Your first day is taking shape.' } },
    { type: 'RatingStars', props: { rating: 6 } },
    { type: 'HotelCard', props: { name: 'A hotel without its required amenities array' } },
    null,
    { type: 'MapPreview', props: { markers: 'not an array' } },
  ]);
  expect(result.blocks).toEqual([
    { type: 'Text', props: { content: 'Your first day is taking shape.' } },
  ]);
  expect(result.rejected).toBe(4);
});

it('rejects unknown and prototype component names without accessing inherited members', () => {
  expect(
    validatePreviewBlocks([
      { type: '__proto__', props: {} },
      { type: 'constructor', props: {} },
      { type: 'UnknownCard', props: {} },
    ])
  ).toEqual({ blocks: [], rejected: 3 });
});

it('preserves unknown prices and removes undeclared generated props', () => {
  const result = validatePreviewBlocks([
    {
      type: 'ActivityCard',
      props: {
        name: 'A walk',
        description: 'Along the waterfront',
        duration: '1 hour',
        time: 'morning',
        priceStatus: 'unknown',
        onPress: 'generated action',
      },
    },
  ]);
  expect(result.rejected).toBe(0);
  expect(result.blocks[0].props).toMatchObject({ name: 'A walk', priceStatus: 'unknown' });
  expect(result.blocks[0].props).not.toHaveProperty('currency');
  expect(result.blocks[0].props).not.toHaveProperty('onPress');
});
