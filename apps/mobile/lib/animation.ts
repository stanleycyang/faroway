import { Platform } from 'react-native';

/** React Native Web does not implement the native animation driver. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
