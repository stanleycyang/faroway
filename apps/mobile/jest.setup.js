jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  return {
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomValues: (array) => nodeCrypto.webcrypto.getRandomValues(array),
    digestStringAsync: async (algorithm, data) => {
      const alg = String(algorithm || 'SHA-256')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      return nodeCrypto.createHash(alg).update(data).digest('hex');
    },
    CryptoDigestAlgorithm: {
      SHA256: 'SHA-256',
      SHA512: 'SHA-512',
    },
  };
});

// Component connectivity behavior uses the library's native-free test adapter.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock')
);
