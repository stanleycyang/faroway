import React from 'react';
import { act, create } from 'react-test-renderer';
const mockPush = jest.fn();
let mockReceived!: (value: unknown) => void;
let mockResponse!: (value: { notification: unknown }) => void;
let mockRelease!: () => void;
const mockRemoveReceived = jest.fn();
const mockRemoveResponse = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('../../lib/notifications', () => ({
  getLastNotificationResponse: async () => null,
  parseNotificationData: () => ({
    type: 'trip_reminder',
    tripId: '11111111-1111-4111-8111-111111111111',
  }),
  addNotificationReceivedListener: async (callback: typeof mockReceived) => {
    mockReceived = callback;
    return { remove: mockRemoveReceived };
  },
  addNotificationResponseListener: (callback: typeof mockResponse) => {
    mockResponse = callback;
    return new Promise((resolve) => {
      mockRelease = () => resolve({ remove: mockRemoveResponse });
    });
  },
  clearBadge: jest.fn(),
}));
import { useNotifications } from '../../hooks/useNotifications';
it('ignores a listener callback after exit while asynchronous subscription setup is pending', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const received = jest.fn();
  function Harness() {
    useNotifications({ onNotificationReceived: received });
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    mockReceived({});
    mockResponse({ notification: {} });
    mockRelease();
  });
  expect(received).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockRemoveReceived).toHaveBeenCalled();
  expect(mockRemoveResponse).toHaveBeenCalled();
});
