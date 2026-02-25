import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@faroway/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
    },
  },
})
