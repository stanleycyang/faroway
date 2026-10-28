import React from 'react';
import { act, create } from 'react-test-renderer';
const mockSignIn = jest.fn();
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value },
}));
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) } },
}));
import { TestEmailLogin } from '../../components/TestEmailLogin';
const savedEnv = { ...process.env };
beforeEach(() => {
  Object.assign(globalThis, { __DEV__: true, IS_REACT_ACT_ENVIRONMENT: true });
  process.env.EXPO_PUBLIC_TEST_LOGIN = 'true';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:55421';
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3011';
  mockSignIn.mockReset();
});
afterEach(() => {
  process.env = { ...savedEnv };
});
it('serializes real sign-in attempts and discards a late callback after dismissal', async () => {
  let finish!: (value: unknown) => void;
  mockSignIn.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const onAuthenticated = jest.fn();
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<TestEmailLogin onAuthenticated={onAuthenticated} />);
  });
  await act(async () => {
    renderer.root
      .findByProps({ testID: 'test-email' })
      .props.onChangeText('owner@mobile-test.invalid');
    renderer.root.findByProps({ testID: 'test-password' }).props.onChangeText('synthetic-password');
  });
  const press = renderer.root.findByProps({ testID: 'test-sign-in' }).props.onPress;
  await act(async () => {
    press();
    press();
  });
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(mockSignIn).toHaveBeenCalledWith({
    email: 'owner@mobile-test.invalid',
    password: 'synthetic-password',
  });
  await act(async () => {
    renderer.update(<TestEmailLogin active={false} onAuthenticated={onAuthenticated} />);
  });
  await act(async () => {
    finish({ error: null });
  });
  expect(onAuthenticated).not.toHaveBeenCalled();
  await act(async () => {
    renderer.unmount();
  });
});
it('hides the panel outside development even with the flag set', async () => {
  Object.assign(globalThis, { __DEV__: false });
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<TestEmailLogin />);
  });
  expect(renderer.toJSON()).toBeNull();
  expect(mockSignIn).not.toHaveBeenCalled();
  await act(async () => {
    renderer.unmount();
  });
});
