import { Platform } from 'react-native';

export const APPLE_SIGN_IN_UNAVAILABLE_MESSAGE =
  'Sign in with Apple is only available on iOS devices';
export const REQUEST_CANCELED_CODE = 'ERR_REQUEST_CANCELED';

export function isAppleSignInSupported() {
  return Platform.OS === 'ios';
}

export function createRequestCanceledError(message = 'Request canceled') {
  return Object.assign(new Error(message), { code: REQUEST_CANCELED_CODE });
}

export function isRequestCanceled(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? error.code === REQUEST_CANCELED_CODE
    : false;
}
