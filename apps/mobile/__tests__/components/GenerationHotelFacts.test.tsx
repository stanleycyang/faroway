import React from 'react';
jest.mock('react-native', () => ({
  View: 'div',
  Text: ({ children }: { children: unknown }) =>
    require('react').createElement('span', null, children),
}));
import { GenerationHotelFacts } from '../../components/GenerationHotelFacts';
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};
it('renders a name-only preview without a fabricated price, score or stars', () => {
  const html = renderToStaticMarkup(<GenerationHotelFacts hotel={{ name: 'A real hotel' }} />);
  expect(html).toContain('A real hotel');
  expect(html).toContain('Price unavailable');
  expect(html).not.toMatch(/200|4\.5|★|\/night/);
});
it('renders real reported hotel facts as estimates in their supplied currency', () => {
  const html = renderToStaticMarkup(
    <GenerationHotelFacts
      hotel={{
        name: 'A real hotel',
        pricePerNight: 137,
        currency: 'GBP',
        starRating: 3,
        userRating: 8.2,
      }}
    />
  );
  expect(html).toContain('Est. GBP 137 / night');
  expect(html).toContain('★★★');
  expect(html).toContain('8.2');
  expect(html).not.toContain('$');
});
it('renders malformed supplier facts without crashing or substituting defaults', () => {
  const html = renderToStaticMarkup(
    <GenerationHotelFacts
      hotel={{
        name: 'A real hotel',
        pricePerNight: '200',
        currency: 'USD',
        starRating: 99,
        userRating: 'great',
      }}
    />
  );
  expect(html).toContain('Price unavailable');
  expect(html).not.toMatch(/200|4\.5|★/);
});
