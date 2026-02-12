import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Phase 16 - Desktop Sidebar & Analytics Charts', () => {

  test('desktop sidebar visibility', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)

    // Verify sidebar is visible on desktop
    const sidebar = page.locator('nav.hidden.md\\:flex')
    await expect(sidebar).toBeVisible()

    // Check nav items
    for (const label of ['Home', 'Vehicles', 'Add', 'Stats', 'Profile']) {
      await expect(sidebar.locator(`text=${label}`)).toBeVisible()
    }

    // Switch to mobile viewport and verify sidebar is hidden
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(sidebar).toBeHidden()
  })

  test('desktop sidebar navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)

    const sidebar = page.locator('nav.hidden.md\\:flex')

    // Click Stats link
    await sidebar.locator('a', { hasText: 'Stats' }).click()
    await page.waitForURL('**/analytics')
    expect(page.url()).toContain('/analytics')

    // Click Vehicles link
    await sidebar.locator('a', { hasText: 'Vehicles' }).click()
    await page.waitForURL('**/vehicles', { timeout: 10000 })
    expect(page.url()).toContain('/vehicles')

    // Click Home link
    await sidebar.locator('a', { hasText: 'Home' }).click()
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('analytics chart expand', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Check if empty state is shown (no fillup data)
    const emptyState = page.locator('text=Log some fillups to see your analytics!')
    if (await emptyState.isVisible()) {
      test.skip(true, 'No fillup data available - skipping chart expand test')
      return
    }

    // Find expand buttons
    const expandButtons = page.locator('button[aria-label*="Expand"]')
    const count = await expandButtons.count()
    expect(count).toBeGreaterThan(0)

    // Click the first expand button
    await expandButtons.first().click()

    // Verify modal overlay appears
    const modal = page.locator('.fixed.inset-0.bg-black\\/50')
    await expect(modal).toBeVisible()

    // Close by pressing Escape
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('analytics dot toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Check if empty state is shown
    const emptyState = page.locator('text=Log some fillups to see your analytics!')
    if (await emptyState.isVisible()) {
      test.skip(true, 'No fillup data available - skipping dot toggle test')
      return
    }

    // Find the Data Points toggle button
    const dotButton = page.locator('button', { hasText: 'Data Points' })
    await expect(dotButton).toBeVisible()

    // Initially should show "Hide Data Points" (showDots defaults to true)
    await expect(dotButton).toHaveText('Hide Data Points')

    // Click to hide
    await dotButton.click()
    await expect(dotButton).toHaveText('Show Data Points')

    // Click to show again
    await dotButton.click()
    await expect(dotButton).toHaveText('Hide Data Points')
  })

  test('monthly spending legend focus mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Check if empty state is shown
    const emptyState = page.locator('text=Log some fillups to see your analytics!')
    if (await emptyState.isVisible()) {
      test.skip(true, 'No fillup data available - skipping legend focus test')
      return
    }

    // Find the Monthly Spending chart card by its heading, then scope to its parent card
    const spendingHeading = page.locator('h2', { hasText: 'Monthly Spending' })
    await expect(spendingHeading).toBeVisible()

    const spendingCard = spendingHeading.locator('..').locator('..')
    const legendItems = spendingCard.locator('.recharts-legend-item')
    const count = await legendItems.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Click first legend item to enter focus mode (dims the other items)
    await legendItems.first().click()
    await page.waitForTimeout(500)

    // Verify focus mode: the non-focused legend items should be dimmed (opacity < 1)
    const hasDimmedItem = await page.evaluate(() => {
      const items = document.querySelectorAll('.recharts-legend-item span')
      for (const item of items) {
        const el = item as HTMLElement
        const opacity = parseFloat(el.style.opacity)
        if (!isNaN(opacity) && opacity < 1) return true
      }
      return false
    })
    expect(hasDimmedItem).toBe(true)

    // Click the same item again to defocus (all items back to normal)
    await legendItems.first().click()
    await page.waitForTimeout(500)

    // Verify all items are back to full opacity
    const allFullOpacity = await page.evaluate(() => {
      const items = document.querySelectorAll('.recharts-legend-item span')
      for (const item of items) {
        const el = item as HTMLElement
        const opacity = parseFloat(el.style.opacity)
        if (!isNaN(opacity) && opacity < 1) return false
      }
      return true
    })
    expect(allFullOpacity).toBe(true)
  })
})
