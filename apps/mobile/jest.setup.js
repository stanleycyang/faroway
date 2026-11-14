jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

// Component connectivity behavior uses the library's native-free test adapter.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock')
);
