import { test, expect } from 'playwright/test'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('shows all settings tabs', async ({ page }) => {
    await expect(page.locator('text=Profil')).toBeVisible()
    await expect(page.locator('text=AI Anweisungen')).toBeVisible()
    await expect(page.locator('text=SLA')).toBeVisible()
    await expect(page.locator('text=Team')).toBeVisible()
    await expect(page.locator('text=Geschäftszeiten')).toBeVisible()
    await expect(page.locator('text=Automatisierung')).toBeVisible()
    await expect(page.locator('text=Audit Trail')).toBeVisible()
  })

  test('business hours tab loads', async ({ page }) => {
    await page.click('text=Geschäftszeiten')
    await expect(page.locator('text=Montag')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Freitag')).toBeVisible()
  })

  test('automation tab loads', async ({ page }) => {
    await page.click('text=Automatisierung')
    await page.waitForTimeout(1000)
    // Should show automation rules UI or empty state
  })
})
