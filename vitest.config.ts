import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@bldmrk/core': path.resolve('./packages/core/src/index.ts'),
      '@': path.resolve('./packages/admin/src'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'plugins/*/src/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
    environmentMatchGlobs: [
      ['packages/admin/**', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**'],
    },
  },
})
