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

  test('monthly spending legend toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Check if empty state is shown
    const emptyState = page.locator('text=Log some fillups to see your analytics!')
    if (await emptyState.isVisible()) {
      test.skip(true, 'No fillup data available - skipping legend toggle test')
      return
    }

    // Find the Monthly Spending chart card by its heading, then scope to its parent card
    const spendingHeading = page.locator('h2', { hasText: 'Monthly Spending' })
    await expect(spendingHeading).toBeVisible()

    // The card structure is: div.bg-white > div (header with h2 + expand) + ResponsiveContainer
    // Navigate up to the card container that holds both the heading and the chart
    const spendingCard = spendingHeading.locator('..').locator('..')
    const legendItem = spendingCard.locator('.recharts-legend-item').first()
    await expect(legendItem).toBeVisible()

    // Click on the legend item to toggle it
    await legendItem.click()

    // Wait for React re-render after state update
    await page.waitForTimeout(500)

    // Verify the clicked legend item text gets strikethrough styling
    // Use page.evaluate for reliable DOM inspection of inline styles
    const hasStrikethrough = await page.evaluate(() => {
      const spans = document.querySelectorAll('.recharts-legend-item span')
      for (const span of spans) {
        const el = span as HTMLElement
        if (el.style.textDecoration === 'line-through') return true
        if (el.style.textDecorationLine === 'line-through') return true
        const computed = window.getComputedStyle(el)
        if (computed.textDecorationLine === 'line-through') return true
      }
      return false
    })
    expect(hasStrikethrough).toBe(true)
  })
})
