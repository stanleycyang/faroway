import React from 'react';
import { act, create } from 'react-test-renderer';
let mockForeground: (state: string) => void;
const mockRemove = jest.fn();
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockForeground = listener;
      return { remove: mockRemove };
    },
  },
}));
import { useLocalCalendarDate } from '../../hooks/useLocalCalendarDate';
let day: string;
function Harness() {
  day = useLocalCalendarDate();
  return null;
}
let renderer: ReturnType<typeof create> | undefined;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 13, 23, 59));
  mockRemove.mockClear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  jest.useRealTimers();
});
it('updates the local travel day at midnight without a network request', async () => {
  await act(async () => {
    renderer = create(<Harness />);
  });
  expect(day).toBe('2026-10-13');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });
  expect(day).toBe('2026-10-14');
});
it('reconciles calendar changes on foreground and releases the clock on exit', async () => {
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    jest.setSystemTime(new Date(2026, 9, 15, 12));
    mockForeground('active');
  });
  expect(day).toBe('2026-10-15');
  await act(async () => renderer!.unmount());
  renderer = undefined;
  expect(mockRemove).toHaveBeenCalledTimes(1);
  jest.runAllTicks();
  mockForeground('active');
  expect(jest.getTimerCount()).toBe(0);
});
