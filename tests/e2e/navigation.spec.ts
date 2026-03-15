import { test, expect } from 'playwright/test'

test.describe('Navigation', () => {
  test('dashboard loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Backlog')).toBeVisible({ timeout: 15000 })
  })

  test('inbox loads', async ({ page }) => {
    await page.goto('/inbox')
    await expect(page.locator('text=Inbox')).toBeVisible({ timeout: 15000 })
  })

  test('insights loads', async ({ page }) => {
    await page.goto('/insights')
    await expect(page.locator('text=Insights')).toBeVisible({ timeout: 15000 })
  })

  test('customers loads', async ({ page }) => {
    await page.goto('/customers')
    await expect(page.locator('text=Kunden')).toBeVisible({ timeout: 15000 })
  })

  test('knowledge base loads', async ({ page }) => {
    await page.goto('/knowledge')
    await expect(page.locator('text=Knowledge Base')).toBeVisible({ timeout: 15000 })
  })

  test('learning loads', async ({ page }) => {
    await page.goto('/learning')
    await expect(page.locator('text=AI Learning')).toBeVisible({ timeout: 15000 })
  })

  test('templates loads', async ({ page }) => {
    await page.goto('/templates')
    await expect(page.locator('text=Antwort-Templates')).toBeVisible({ timeout: 15000 })
  })

  test('settings loads', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('text=Einstellungen')).toBeVisible({ timeout: 15000 })
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/')
    await page.click('a[href="/inbox"]')
    await expect(page).toHaveURL('/inbox')
    await expect(page.locator('text=Inbox')).toBeVisible()
  })
})
