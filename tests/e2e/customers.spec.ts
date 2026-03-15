import { test, expect } from 'playwright/test'

const mockCustomers = [
  {
    email: 'anna@example.com',
    name: 'Anna Muster',
    totalEmails: 5,
    avgBuyingIntent: 70,
    dominantSentiment: 'positive',
    lastContact: '2026-03-14T10:00:00Z',
    resolvedCount: 4,
    sentiments: { positive: 4, neutral: 1 },
  },
  {
    email: 'bob@example.com',
    name: 'Bob Schmidt',
    totalEmails: 2,
    avgBuyingIntent: 30,
    dominantSentiment: 'neutral',
    lastContact: '2026-03-10T14:00:00Z',
    resolvedCount: 1,
    sentiments: { neutral: 2 },
  },
  {
    email: 'carol@example.com',
    name: 'Carol Weber',
    totalEmails: 8,
    avgBuyingIntent: 20,
    dominantSentiment: 'negative',
    lastContact: '2026-03-05T09:00:00Z',
    resolvedCount: 5,
    sentiments: { negative: 3, neutral: 5 },
  },
]

test.describe('Customers', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/customers**', async route => {
      const url = route.request().url()
      const searchParam = new URL(url).searchParams.get('search')
      let customers = mockCustomers
      if (searchParam) {
        const q = searchParam.toLowerCase()
        customers = mockCustomers.filter(
          c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        )
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ customers }),
      })
    })

    await page.goto('/customers')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with header Kunden', async ({ page }) => {
    await expect(page.locator('text=Kunden')).toBeVisible({ timeout: 15000 })
  })

  test('customer list renders with names', async ({ page }) => {
    await expect(page.locator('text=Anna Muster')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Bob Schmidt')).toBeVisible()
    await expect(page.locator('text=Carol Weber')).toBeVisible()
  })

  test('search input is present', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="suchen"], input[placeholder*="Suchen"]')
    await expect(searchInput.first()).toBeVisible()
  })

  test('search filters customers', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="suchen"], input[placeholder*="Suchen"]').first()
    await searchInput.fill('Anna')
    await page.waitForTimeout(600) // debounce delay
    await expect(page.locator('text=Anna Muster')).toBeVisible()
  })

  test('sort dropdown is present', async ({ page }) => {
    const sortTrigger = page.locator('[role="combobox"]').first()
    await expect(sortTrigger).toBeVisible()
  })

  test('sort dropdown options can be opened', async ({ page }) => {
    const sortTrigger = page.locator('[role="combobox"]').first()
    await sortTrigger.click()
    await expect(page.locator('text=Letzter Kontakt').or(page.locator('text=Name')).first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('sentiment filter chips are displayed', async ({ page }) => {
    await expect(page.locator('button:has-text("Alle")')).toBeVisible()
    await expect(page.locator('button:has-text("Positiv")')).toBeVisible()
    await expect(page.locator('button:has-text("Neutral")')).toBeVisible()
    await expect(page.locator('button:has-text("Negativ")')).toBeVisible()
  })

  test('sentiment filter Negativ works', async ({ page }) => {
    await page.locator('button:has-text("Negativ")').click()
    await page.waitForTimeout(200)
    // Only Carol Weber has negative sentiment — others should be filtered out
    await expect(page.locator('text=Carol Weber')).toBeVisible()
    // Anna Muster (positive) should not be visible
    await expect(page.locator('text=Anna Muster')).not.toBeVisible()
  })

  test('sentiment filter Alle resets filter', async ({ page }) => {
    // First filter by Negativ
    await page.locator('button:has-text("Negativ")').click()
    await page.waitForTimeout(200)
    // Then reset to Alle
    await page.locator('button:has-text("Alle")').click()
    await page.waitForTimeout(200)
    await expect(page.locator('text=Anna Muster')).toBeVisible()
    await expect(page.locator('text=Bob Schmidt')).toBeVisible()
  })

  test('customer click navigates to detail page', async ({ page }) => {
    const customerLink = page.locator('a[href*="/customers/"]').first()
    await expect(customerLink).toBeVisible({ timeout: 10000 })
    const href = await customerLink.getAttribute('href')
    expect(href).toMatch(/\/customers\//)
    await customerLink.click()
    await expect(page).toHaveURL(/\/customers\//)
  })

  test('summary stats show customer counts', async ({ page }) => {
    await expect(page.locator('text=Kunden total')).toBeVisible({ timeout: 10000 })
  })

  test('sort direction toggle button exists', async ({ page }) => {
    // The sort direction button shows ↑ or ↓
    const sortDirBtn = page.locator('button:has-text("↓"), button:has-text("↑")')
    await expect(sortDirBtn.first()).toBeVisible()
  })

  test('pagination does not appear for small lists', async ({ page }) => {
    // Only 3 customers (< 20), so pagination should not be shown
    await expect(page.locator('text=Zurück').and(page.locator('button'))).not.toBeVisible()
  })
})

test.describe('Customers - pagination', () => {
  test('pagination appears for large lists', async ({ page }) => {
    const manyCustomers = Array.from({ length: 25 }, (_, i) => ({
      email: `customer${i}@example.com`,
      name: `Kunde ${i + 1}`,
      totalEmails: 3,
      avgBuyingIntent: 50,
      dominantSentiment: 'neutral',
      lastContact: '2026-03-01T10:00:00Z',
      resolvedCount: 1,
      sentiments: { neutral: 3 },
    }))

    await page.route('**/api/customers**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ customers: manyCustomers }),
      })
    })

    await page.goto('/customers')
    await page.waitForLoadState('networkidle')

    // With 25 customers, pagination should appear
    await expect(page.locator('button:has-text("Weiter")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Seite 1')).toBeVisible()
  })
})
