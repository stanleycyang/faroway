let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

import {
  APPLE_SIGN_IN_UNAVAILABLE_MESSAGE,
  createRequestCanceledError,
  isAppleSignInSupported,
  isRequestCanceled,
  REQUEST_CANCELED_CODE,
} from '../../lib/authProviders';

describe('auth provider helpers', () => {
  beforeEach(() => {
    mockPlatformOS = 'ios';
  });

  it('supports Sign in with Apple only on iOS', () => {
    expect(isAppleSignInSupported()).toBe(true);

    mockPlatformOS = 'android';
    expect(isAppleSignInSupported()).toBe(false);

    mockPlatformOS = 'web';
    expect(isAppleSignInSupported()).toBe(false);
  });

  it('keeps a user-facing unavailable message for blocked Apple auth attempts', () => {
    expect(APPLE_SIGN_IN_UNAVAILABLE_MESSAGE).toContain('iOS');
  });

  it('identifies local request-cancellation errors', () => {
    const error = createRequestCanceledError('Closed by user');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(REQUEST_CANCELED_CODE);
    expect(isRequestCanceled(error)).toBe(true);
    expect(isRequestCanceled(new Error('Closed by user'))).toBe(false);
  });
});
