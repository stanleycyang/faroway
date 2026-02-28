import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@faroway/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
      '@faroway/constants': path.resolve(__dirname, '../../packages/constants/src/index.ts'),
    },
  },
})
