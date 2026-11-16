import React from 'react';
import { act, create } from 'react-test-renderer';
import { FontScaleText, useFontScaleEpoch } from '../lib/fontScaleEpoch';

const metrics = { fontScale: 1 };

jest.mock('react-native', () => ({
  Text: 'Text',
  useWindowDimensions: () => ({
    width: 390,
    height: 844,
    scale: 1,
    fontScale: metrics.fontScale,
  }),
}));

function EpochProbe() {
  const epoch = useFontScaleEpoch();
  return <FontScaleText testID={epoch}>Explore</FontScaleText>;
}

function textKey(tree: ReturnType<typeof create>) {
  return tree.root.findByType('Text' as never).props.testID as string;
}

it('keeps the cold-start measurement at an enlarged font scale', () => {
  metrics.fontScale = 1.5;
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(<EpochProbe />);
  });
  expect(textKey(tree!)).toBe('cold');
});

it('remounts text only after the font scale changes while the app is running', () => {
  metrics.fontScale = 1;
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(<EpochProbe />);
  });
  expect(textKey(tree!)).toBe('cold');
  metrics.fontScale = 1.5;
  act(() => {
    tree!.update(<EpochProbe />);
  });
  expect(textKey(tree!)).toBe('font-scale-1.5');
});
