import { test as base } from '@playwright/test'
import { loginAs } from './auth.js'

export const test = base.extend<{ authedPage: void }>({
  authedPage: async ({ page }, use) => {
    await loginAs(page)
    await use()
  },
})

export { expect } from '@playwright/test'
