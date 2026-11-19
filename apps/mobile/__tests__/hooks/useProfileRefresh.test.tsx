import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockFetch = jest.fn();
const mockRemove = jest.fn();
let mockForeground: (state: string) => void;
jest.mock('../../services/api', () => ({
  getVerifiedUserProfile: (...args: unknown[]) => mockFetch(...args),
}));
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, callback: typeof mockForeground) => {
      mockForeground = callback;
      return { remove: mockRemove };
    },
  },
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    require('react').useEffect(effect, [effect]),
}));
import { useProfileRefresh } from '../../hooks/useProfileRefresh';
import { useUserStore } from '../../stores/userStore';
let status: ReturnType<typeof useProfileRefresh>;
let renderer: ReactTestRenderer;
function Probe() {
  status = useProfileRefresh();
  return null;
}
const user = (id = 'qa') => ({
  id,
  name: 'QA',
  email: `${id}@example.invalid`,
  preferences: { vibes: [] as string[] },
});
const response = (vibes = ['culture', 'foodie'], id = 'qa') => ({
  data: { ...user(id), preferences: { vibes } },
});
function deferred() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  const promise = new Promise<ReturnType<typeof response>>((r) => (resolve = r));
  return { promise, resolve };
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.clearAllMocks();
  useUserStore.getState().setUser(user());
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
async function render() {
  await act(async () => {
    renderer = create(<Probe />);
  });
}
it('recovers preferences after initial auth enrichment was unavailable', async () => {
  mockFetch.mockResolvedValue(response());
  await render();
  expect(useUserStore.getState().user?.preferences.vibes).toEqual(['culture', 'foodie']);
  expect(status).toBe('ready');
});
it('reports unavailable instead of claiming empty preferences and retries on foreground', async () => {
  mockFetch.mockResolvedValueOnce({ error: 'offline' }).mockResolvedValueOnce(response());
  await render();
  expect(status).toBe('error');
  await act(async () => mockForeground('active'));
  expect(status).toBe('ready');
  expect(useUserStore.getState().user?.preferences.vibes).toEqual(['culture', 'foodie']);
});
it('does not overwrite a newer local preference edit', async () => {
  const read = deferred();
  mockFetch.mockReturnValue(read.promise);
  await render();
  await act(async () => useUserStore.getState().updatePreferences({ vibes: ['nature'] }));
  await act(async () => read.resolve(response()));
  expect(useUserStore.getState().user?.preferences.vibes).toEqual(['nature']);
});
it('rejects a delayed read across an account switch', async () => {
  const read = deferred();
  mockFetch.mockReturnValueOnce(read.promise).mockResolvedValueOnce(response(['foodie'], 'other'));
  await render();
  await act(async () => useUserStore.getState().setUser(user('other')));
  await act(async () => read.resolve(response()));
  expect(useUserStore.getState().user?.id).toBe('other');
  expect(useUserStore.getState().user?.preferences.vibes).toEqual(['foodie']);
});
it('keeps the newest foreground response when an earlier read finishes later', async () => {
  const old = deferred();
  mockFetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(['nature']));
  await render();
  await act(async () => mockForeground('active'));
  await act(async () => old.resolve(response()));
  expect(useUserStore.getState().user?.preferences.vibes).toEqual(['nature']);
});
it('ignores completion after blur/unmount and removes the foreground listener', async () => {
  const read = deferred();
  mockFetch.mockReturnValue(read.promise);
  await render();
  await act(async () => renderer.unmount());
  await act(async () => read.resolve(response()));
  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(useUserStore.getState().user?.preferences.vibes).toEqual([]);
});
it('rejects a wrong-account profile response', async () => {
  mockFetch.mockResolvedValue(response(['foodie'], 'other'));
  await render();
  expect(status).toBe('error');
  expect(useUserStore.getState().user?.preferences.vibes).toEqual([]);
});
