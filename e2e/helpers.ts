import { Page, expect } from '@playwright/test'

export async function login(page: Page) {
  const username = process.env.USERNAME!
  const password = process.env.PASSWORD!

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  const emailInput = page.locator('#email')
  await expect(emailInput).toBeVisible()

  await emailInput.fill(username)
  await page.locator('#password').fill(password)

  await page.locator('button[type="submit"]').click()

  // Login redirects to / which then redirects authenticated users to /dashboard
  await page.waitForURL('**/dashboard', { timeout: 20000 })
}
