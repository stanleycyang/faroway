import React from 'react';
import type { DayTimingProposal } from '@faroway/types';
jest.mock('react-native', () => ({
  View: ({ children }: { children: unknown }) =>
    require('react').createElement('div', null, children),
  Text: ({ children }: { children: unknown }) =>
    require('react').createElement('span', null, children),
  StyleSheet: { create: (styles: unknown) => styles },
}));
import { ProposedTiming } from '../../components/ProposedTiming';
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};
const proposal: DayTimingProposal = {
  policy: 'midday-rest-v1',
  basis: 'fixture',
  verified: false,
  fitsPolicy: true,
  conflict: null,
  events: [
    {
      id: 'activity:garden',
      kind: 'activity',
      durationMinutes: 90,
      startMinute: 540,
      endMinute: 630,
      bufferBeforeMinutes: 0,
    },
    {
      id: 'rest:midday',
      kind: 'rest',
      durationMinutes: 60,
      startMinute: 780,
      endMinute: 840,
      bufferBeforeMinutes: 0,
    },
  ],
};
it('renders provisional times, rest, supplied place names and assumptions', () => {
  const html = renderToStaticMarkup(
    <ProposedTiming proposal={proposal} names={{ 'activity:garden': 'Botanic Gardens' }} />
  );
  for (const text of [
    'Suggested timing',
    'Botanic Gardens',
    '13:00–14:00',
    'Midday rest',
    'not confirmed bookings',
    'hotel return need checking',
  ])
    expect(html).toContain(text);
});
it('renders a review message without any partial timetable for a conflict', () => {
  const html = renderToStaticMarkup(
    <ProposedTiming
      proposal={{
        ...proposal,
        fitsPolicy: false,
        events: [],
        conflict: { eventId: 'activity:garden', overrunMinutes: 30 },
      }}
      names={{}}
    />
  );
  expect(html).toContain('Timing needs review');
  expect(html).toContain('Review the schedule before using it');
  expect(html).not.toContain('09:00');
});
