import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
