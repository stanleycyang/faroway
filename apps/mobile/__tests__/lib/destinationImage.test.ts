import { destinationImage } from '../../lib/destinationImage';

describe('trip destination photography', () => {
  it('uses the same city image for a name with or without its country', () => {
    expect(destinationImage('Lisbon, Portugal')).toBe(destinationImage('Lisbon'));
    expect(destinationImage('Copenhagen, Denmark')).toContain('/destinations/copenhagen-');
    expect(destinationImage(' New York, United States ')).toContain('/destinations/new-york-');
  });
  it('uses general travel photography for an unknown place rather than a different city', () => {
    expect(destinationImage('Unknown harbor')).toContain('/blog/');
    expect(destinationImage('__proto__')).toContain('/blog/');
    expect(destinationImage('Paris, USA')).toContain('/blog/');
    expect(destinationImage('Melbourne, USA')).toContain('/blog/');
    expect(destinationImage('Paris, Texas, USA')).toContain('/blog/');
  });
});

it('uses reviewed Melbourne photography on mobile', () => {
  expect(destinationImage('Melbourne, Australia')).toContain('photo-1634172770871-28ab3ddb6a56');
});
