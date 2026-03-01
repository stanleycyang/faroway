import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@faroway/types': path.resolve(__dirname, '../types/src/index.ts'),
    },
  },
});
